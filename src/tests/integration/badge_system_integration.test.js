/**
 * @file badge_system_integration.test.js
 * @description Integration tests for Badge System in the Event-Driven Architecture
 *
 * Tests verify that:
 * - Badge system integrates properly with the event-driven background script
 * - Badge text updates correctly when called from background.js
 * - Badge system works with site detection and usage storage
 * - Error handling works properly in the integrated system
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock browser APIs
const mockActionArea = {
  setBadgeText: jest.fn(),
  setBadgeBackgroundColor: jest.fn(),
};

const mockTabsArea = {
  get: jest.fn(),
};

const mockStorageArea = {
  get: jest.fn(),
  set: jest.fn(),
};

global.browser = {
  action: mockActionArea,
  tabs: mockTabsArea,
  storage: {
    local: mockStorageArea,
  },
};

// Mock crypto for ID generation
global.crypto = {
  randomUUID: jest.fn(),
};

// Create mock modules before importing
const mockSiteStorage = {
  getDistractingSites: jest.fn(),
};

const mockUsageStorage = {
  getUsageStats: jest.fn(),
};

const mockDistractionDetector = {
  checkIfUrlIsDistracting: jest.fn(),
  initializeDistractionDetector: jest.fn(),
};

// Mock the modules before importing
jest.unstable_mockModule(
  '../../background_scripts/site_storage.js',
  () => mockSiteStorage
);
jest.unstable_mockModule(
  '../../background_scripts/usage_storage.js',
  () => mockUsageStorage
);
jest.unstable_mockModule(
  '../../background_scripts/distraction_detector.js',
  () => mockDistractionDetector
);

describe('Badge System Integration', () => {
  let mockLocalStorageData;
  let badgeManager;
  let consoleErrorSpy;
  let uuidCounter;

  beforeEach(async () => {
    // Reset mock data
    mockLocalStorageData = {};
    uuidCounter = 0;

    // Setup storage mocks
    mockStorageArea.get.mockImplementation(async (key) => {
      if (typeof key === 'string') {
        const result = {};
        if (mockLocalStorageData[key] !== undefined) {
          result[key] = mockLocalStorageData[key];
        }
        return Promise.resolve(result);
      } else if (Array.isArray(key)) {
        const result = {};
        key.forEach((k) => {
          if (mockLocalStorageData[k] !== undefined) {
            result[k] = mockLocalStorageData[k];
          }
        });
        return Promise.resolve(result);
      }
      return Promise.resolve({});
    });

    mockStorageArea.set.mockImplementation(async (items) => {
      Object.assign(mockLocalStorageData, items);
      return Promise.resolve();
    });

    // Setup UUID generation
    global.crypto.randomUUID.mockImplementation(
      () => `test-uuid-${++uuidCounter}`
    );

    // Setup console spy
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Reset mock modules
    mockSiteStorage.getDistractingSites.mockReset();
    mockUsageStorage.getUsageStats.mockReset();
    mockDistractionDetector.checkIfUrlIsDistracting.mockReset();

    // Setup default mocks - Updated to match new implementation
    mockSiteStorage.getDistractingSites.mockImplementation(async () => {
      return mockLocalStorageData.distractingSites || [];
    });

    mockUsageStorage.getUsageStats.mockImplementation(async (dateKey) => {
      return mockLocalStorageData[`usageStats-${dateKey}`] || {};
    });

    mockDistractionDetector.checkIfUrlIsDistracting.mockImplementation(
      (url) => {
        const sites = mockLocalStorageData.distractingSites || [];
        for (const site of sites) {
          if (url.includes(site.urlPattern)) {
            return { isMatch: true, siteId: site.id };
          }
        }
        return { isMatch: false, siteId: null };
      }
    );

    // Clear all mocks
    jest.clearAllMocks();

    // Import modules fresh
    jest.resetModules();
    badgeManager = await import('../../background_scripts/badge_manager.js');
    await import('../../background_scripts/site_storage.js');
    await import('../../background_scripts/usage_storage.js');
    await import('../../background_scripts/distraction_detector.js');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('badge updates in event-driven architecture', () => {
    it('should update badge when called for distracting site', async () => {
      // Setup site with time limit
      const testSite = {
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600, // 1 hour
        isEnabled: true,
      };
      mockLocalStorageData.distractingSites = [testSite];

      // Setup usage data: 1800 seconds used = 30 minutes, so 30 minutes remaining
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        site1: { timeSpentSeconds: 1800, opens: 3 }, // 30 minutes used
      };

      // Mock tab
      const mockTab = {
        id: 123,
        url: 'https://facebook.com',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      // Call updateBadge (as background.js would)
      await badgeManager.updateBadge(123);

      // Verify badge was set correctly (3600 - 1800 = 1800 seconds = 30 minutes)
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '30m', // 30 minutes remaining
        tabId: 123,
      });
      expect(mockActionArea.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: [0, 122, 255, 255],
        tabId: 123,
      });
    });

    it('should clear badge for non-distracting sites', async () => {
      const mockTab = {
        id: 456,
        url: 'https://example.com',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await badgeManager.updateBadge(456);

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '',
        tabId: 456,
      });
    });

    it('should handle sites with combined time and open limits', async () => {
      // Setup site with both limits
      const testSite = {
        id: 'site2',
        urlPattern: 'youtube.com',
        dailyLimitSeconds: 7200, // 2 hours
        dailyOpenLimit: 10,
        isEnabled: true,
      };
      mockLocalStorageData.distractingSites = [testSite];

      // Setup usage data with both time and opens used
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        site2: { timeSpentSeconds: 3600, opens: 7 }, // 1 hour used, 7 opens used
      };

      const mockTab = {
        id: 789,
        url: 'https://youtube.com/watch?v=test',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await badgeManager.updateBadge(789);

      // Should show remaining time and remaining opens
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '1h/3', // 1 hour remaining / 3 opens remaining
        tabId: 789,
      });
    });

    it('should show zero when limits are exceeded', async () => {
      // Setup site with exceeded limits
      const testSite = {
        id: 'site3',
        urlPattern: 'reddit.com',
        dailyLimitSeconds: 1800, // 30 minutes
        dailyOpenLimit: 5,
        isEnabled: true,
      };
      mockLocalStorageData.distractingSites = [testSite];

      // Setup usage data with exceeded limits
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        site3: { timeSpentSeconds: 2400, opens: 8 }, // 40 minutes used, 8 opens used
      };

      const mockTab = {
        id: 101,
        url: 'https://reddit.com/r/test',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await badgeManager.updateBadge(101);

      // Should show zeros for exceeded limits
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '0s/0', // 0 time remaining / 0 opens remaining
        tabId: 101,
      });
    });

    it('should handle disabled sites', async () => {
      // Setup disabled site
      const testSite = {
        id: 'site4',
        urlPattern: 'twitter.com',
        dailyLimitSeconds: 3600,
        isEnabled: false, // Disabled
      };
      mockLocalStorageData.distractingSites = [testSite];

      const mockTab = {
        id: 202,
        url: 'https://twitter.com',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await badgeManager.updateBadge(202);

      // Should clear badge for disabled sites
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '',
        tabId: 202,
      });
    });
  });

  describe('error handling integration', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock storage error
      mockStorageArea.get.mockRejectedValue(new Error('Storage error'));

      const mockTab = {
        id: 303,
        url: 'https://facebook.com',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await expect(badgeManager.updateBadge(303)).resolves.not.toThrow();

      // Should clear badge on storage error
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '',
        tabId: 303,
      });
    });

    it('should handle tab fetch errors gracefully', async () => {
      mockTabsArea.get.mockRejectedValue(new Error('Tab not found'));

      await expect(badgeManager.updateBadge(404)).resolves.not.toThrow();

      // Should attempt to clear badge even on tab error
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '',
        tabId: 404,
      });
    });

    it('should handle badge API errors gracefully', async () => {
      const testSite = {
        id: 'site5',
        urlPattern: 'instagram.com',
        dailyLimitSeconds: 1800,
        isEnabled: true,
      };
      mockLocalStorageData.distractingSites = [testSite];

      const mockTab = {
        id: 505,
        url: 'https://instagram.com',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      // Mock badge API error
      mockActionArea.setBadgeText.mockRejectedValue(
        new Error('Badge API error')
      );

      await expect(badgeManager.updateBadge(505)).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BadgeManager] Error setting badge text:',
        expect.any(Error)
      );
    });
  });

  describe('edge cases and data validation', () => {
    it('should handle missing usage data', async () => {
      // Setup site but no usage data
      const testSite = {
        id: 'site6',
        urlPattern: 'github.com',
        dailyLimitSeconds: 7200, // 2 hours
        isEnabled: true,
      };
      mockLocalStorageData.distractingSites = [testSite];
      // No usage data in storage

      const mockTab = {
        id: 606,
        url: 'https://github.com',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await badgeManager.updateBadge(606);

      // Should show full limit when no usage data
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '2h', // Full 2 hours
        tabId: 606,
      });
    });

    it('should handle sites not in storage', async () => {
      // Empty sites storage
      mockLocalStorageData.distractingSites = [];

      const mockTab = {
        id: 707,
        url: 'https://unknown-distracting-site.com',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await badgeManager.updateBadge(707);

      // Should clear badge for sites not in storage
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '',
        tabId: 707,
      });
    });

    it('should handle browser internal pages', async () => {
      const mockTab = {
        id: 808,
        url: 'chrome://settings/',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await badgeManager.updateBadge(808);

      // Should clear badge for internal pages
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: '',
        tabId: 808,
      });
    });
  });

  describe('performance and consistency', () => {
    it('should handle multiple rapid badge updates', async () => {
      const testSite = {
        id: 'site7',
        urlPattern: 'example.com',
        dailyLimitSeconds: 3600,
        isEnabled: true,
      };
      mockLocalStorageData.distractingSites = [testSite];

      const mockTab = {
        id: 909,
        url: 'https://example.com',
        status: 'complete',
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      // Make multiple rapid calls (as might happen in real usage)
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(badgeManager.updateBadge(909));
      }

      await expect(Promise.allSettled(promises)).resolves.toBeDefined();

      // All calls should complete without errors
      const results = await Promise.allSettled(promises);
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });

    it('should maintain consistency across multiple tabs', async () => {
      const testSite = {
        id: 'site8',
        urlPattern: 'multitab-site.com',
        dailyLimitSeconds: 1800, // 30 minutes
        isEnabled: true,
      };
      mockLocalStorageData.distractingSites = [testSite];

      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        site8: { timeSpentSeconds: 600, opens: 2 }, // 10 minutes used
      };

      // Setup multiple tabs for the same site
      const tabs = [
        { id: 1001, url: 'https://multitab-site.com/page1' },
        { id: 1002, url: 'https://multitab-site.com/page2' },
        { id: 1003, url: 'https://multitab-site.com/page3' },
      ];

      // Mock tab.get to return appropriate tab for each call
      mockTabsArea.get.mockImplementation(async (tabId) => {
        return tabs.find((tab) => tab.id === tabId);
      });

      // Update badges for all tabs
      await Promise.all(tabs.map((tab) => badgeManager.updateBadge(tab.id)));

      // All tabs should show the same badge text
      tabs.forEach((tab) => {
        expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
          text: '20m', // 20 minutes remaining (30 - 10)
          tabId: tab.id,
        });
      });
    });
  });
});
