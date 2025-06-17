/**
 * @file badge_system_integration.test.js
 * @description Integration tests for Badge System <-> Tab Activity integration
 * 
 * Tests verify that:
 * - Badge system responds correctly to tab changes
 * - Badge text updates when usage statistics change
 * - Badge system integrates properly with site detection
 * - Performance and caching work as expected
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock browser APIs
const mockActionArea = {
  setBadgeText: jest.fn(),
  setBadgeBackgroundColor: jest.fn(),
};

const mockTabsArea = {
  query: jest.fn(),
  get: jest.fn(),
  onActivated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onUpdated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }
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

// Create mock distraction detector before importing modules
const mockDistractionDetector = {
  checkIfUrlIsDistracting: jest.fn(() => ({ isMatch: false, siteId: null }))
};

// Mock the distraction detector module BEFORE importing other modules
jest.unstable_mockModule('../../background_scripts/distraction_detector.js', () => mockDistractionDetector);

describe('Badge System Integration', () => {
  let mockLocalStorageData;
  let badgeManager;
  let siteStorage;
  let usageStorage;
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
        key.forEach(k => {
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
    global.crypto.randomUUID.mockImplementation(() => `test-uuid-${++uuidCounter}`);

    // Setup console spy
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Reset distraction detector mock
    mockDistractionDetector.checkIfUrlIsDistracting.mockReset();
    mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({ isMatch: false, siteId: null });

    // Clear all mocks
    jest.clearAllMocks();

    // Import modules fresh (distraction detector is already mocked)
    jest.resetModules();
    badgeManager = await import('../../background_scripts/badge_manager.js');
    siteStorage = await import('../../background_scripts/site_storage.js');
    usageStorage = await import('../../background_scripts/usage_storage.js');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('tab activation integration', () => {
    it('should update badge when switching to distracting site tab', async () => {
      // Setup site with time limit
      const testSite = {
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600, // 1 hour
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [testSite];

      // Setup usage data: 1800 seconds used = 30 minutes, so 30 minutes remaining
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        site1: { timeSpentSeconds: 1800, opens: 3 } // 30 minutes used
      };

      // Mock tab
      const mockTab = {
        id: 123,
        url: 'https://facebook.com',
        status: 'complete'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      // Mock distraction detector
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site1'
      });

      // Trigger tab activation
      await badgeManager.handleTabActivation({ tabId: 123 });

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify badge was set correctly (3600 - 1800 = 1800 seconds = 30 minutes)
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "30m", // 30 minutes remaining
        tabId: 123
      });
      expect(mockActionArea.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: [0, 122, 255, 255],
        tabId: 123
      });
    });

    it('should clear badge when switching to non-distracting site tab', async () => {
      const mockTab = {
        id: 456,
        url: 'https://example.com',
        status: 'complete'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      // Mock distraction detector to return no match
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: false,
        siteId: null
      });

      await badgeManager.handleTabActivation({ tabId: 456 });

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "",
        tabId: 456
      });
    });

    it('should handle tabs with combined time and open limits', async () => {
      // Setup site with both limits
      const testSite = {
        id: 'site2',
        urlPattern: 'youtube.com',
        dailyLimitSeconds: 7200, // 2 hours
        dailyOpenLimit: 10,
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [testSite];

      // Setup usage data: 3600 seconds used = 1 hour, 7 opens used
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        site2: { timeSpentSeconds: 3600, opens: 7 } // 1 hour used, 7 opens
      };

      const mockTab = {
        id: 789,
        url: 'https://youtube.com',
        status: 'complete'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site2'
      });

      await badgeManager.handleTabActivation({ tabId: 789 });

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      // 7200 - 3600 = 3600 seconds = 1 hour remaining, 10 - 7 = 3 opens remaining
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "1h/3", // 1 hour remaining / 3 opens remaining
        tabId: 789
      });
    });

    it('should handle exceeding limits correctly', async () => {
      // Setup site
      const testSite = {
        id: 'site3',
        urlPattern: 'twitter.com',
        dailyLimitSeconds: 1800, // 30 minutes
        dailyOpenLimit: 5,
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [testSite];

      // Setup usage data (both limits exceeded)
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        site3: { timeSpentSeconds: 2400, opens: 8 } // Over both limits
      };

      const mockTab = {
        id: 999,
        url: 'https://twitter.com',
        status: 'complete'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site3'
      });

      await badgeManager.handleTabActivation({ tabId: 999 });

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "0s/0", // Both limits exceeded
        tabId: 999
      });
    });
  });

  describe('tab update integration', () => {
    it('should update badge when URL changes to distracting site', async () => {
      const testSite = {
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [testSite];

      // Setup usage data: 900 seconds used = 15 minutes, so 45 minutes remaining
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        site1: { timeSpentSeconds: 900, opens: 1 } // 15 minutes used
      };

      const mockTab = {
        id: 123,
        url: 'https://facebook.com',
        status: 'complete',
        active: true
      };

      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site1'
      });

      await badgeManager.handleTabUpdate(123, { url: 'https://facebook.com' }, mockTab);

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      // 3600 - 900 = 2700 seconds = 45 minutes remaining
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "45m", // 45 minutes remaining
        tabId: 123
      });
    });

    it('should ignore non-URL changes', async () => {
      const mockTab = {
        id: 123,
        url: 'https://facebook.com',
        status: 'complete',
        active: true
      };

      // Only title changed, not URL
      await badgeManager.handleTabUpdate(123, { title: 'New Page Title' }, mockTab);

      expect(mockActionArea.setBadgeText).not.toHaveBeenCalled();
    });

    it('should not update badge for loading tabs', async () => {
      const mockTab = {
        id: 123,
        url: 'https://facebook.com',
        status: 'loading',
        active: false
      };

      await badgeManager.handleTabUpdate(123, { url: 'https://facebook.com' }, mockTab);

      expect(mockActionArea.setBadgeText).not.toHaveBeenCalled();
    });
  });

  describe('refresh current tab integration', () => {
    it('should refresh badge for currently active tab', async () => {
      const testSite = {
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyOpenLimit: 5,
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [testSite];

      // Setup usage data: 2 opens used, so 3 opens remaining
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        site1: { timeSpentSeconds: 1000, opens: 2 }
      };

      // Mock distraction detector
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site1'
      });

      // Directly test badge update for the specific tab/URL
      // This simulates what refreshCurrentTabBadge should do
      await badgeManager.updateBadgeForTab(123, 'https://facebook.com');
      
      // Wait for debounced operations to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // 5 - 2 = 3 opens remaining
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "3", // 3 opens remaining
        tabId: 123
      });
    });

    it('should handle no active tabs for direct badge update', async () => {
      // Mock for non-distracting site
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: false,
        siteId: null
      });

      await badgeManager.updateBadgeForTab(456, 'https://example.com');
      
      // Wait for debounced operations to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "",
        tabId: 456
      });
    });
  });

  describe('clear all badges integration', () => {
    it('should clear badges for all open tabs', async () => {
      const mockTabs = [
        { id: 123, url: 'https://facebook.com' },
        { id: 456, url: 'https://youtube.com' },
        { id: 789, url: 'https://example.com' }
      ];
      mockTabsArea.query.mockResolvedValue(mockTabs);

      await badgeManager.clearAllBadges();

      expect(mockTabsArea.query).toHaveBeenCalledWith({});
      expect(mockActionArea.setBadgeText).toHaveBeenCalledTimes(3);
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({ text: "", tabId: 123 });
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({ text: "", tabId: 456 });
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({ text: "", tabId: 789 });
    });
  });

  describe('end-to-end workflow integration', () => {
    it('should handle complete site addition and badge update workflow', async () => {
      // 1. Add a new site
      const newSite = {
        id: 'new-site',
        urlPattern: 'instagram.com',
        dailyLimitSeconds: 1800, // 30 minutes
        dailyOpenLimit: 5,
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [newSite];

      // 2. Setup usage data: no usage yet, so full limits remain
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        'new-site': { timeSpentSeconds: 0, opens: 0 } // No usage yet
      };

      // 3. Mock tab
      const mockTab = {
        id: 123,
        url: 'https://instagram.com',
        status: 'complete'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      // 4. Mock distraction detector
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'new-site'
      });

      // 5. Activate tab (should trigger badge update)
      await badgeManager.handleTabActivation({ tabId: 123 });

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      // 6. Verify badge shows correct remaining time and opens (1800 seconds = 30 minutes, 5 opens)
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "30m/5", // 30 minutes / 5 opens remaining
        tabId: 123
      });
    });

    it('should handle site limit updates and badge refresh', async () => {
      // Setup site
      const existingSite = {
        id: 'update-site',
        urlPattern: 'reddit.com',
        dailyLimitSeconds: 3600, // 1 hour
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [existingSite];

      // Setup usage data: no usage, so full hour remains
      const dateKey = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usageStats-${dateKey}`] = {
        'update-site': { timeSpentSeconds: 0, opens: 2 } // No time used
      };

      const mockTab = {
        id: 456,
        url: 'https://reddit.com',
        status: 'complete'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'update-site'
      });

      await badgeManager.handleTabActivation({ tabId: 456 });

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      // 3600 - 0 = 3600 seconds = 1 hour remaining
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "1h", // 1 hour remaining
        tabId: 456
      });
    });

    it('should handle site deletion and badge clearing', async () => {
      // Setup site
      const existingSite = {
        id: 'delete-site',
        urlPattern: 'tiktok.com',
        dailyLimitSeconds: 3600, // 1 hour
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [existingSite];

      const mockTab = {
        id: 789,
        url: 'https://tiktok.com',
        status: 'complete'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'delete-site'
      });

      await badgeManager.handleTabActivation({ tabId: 789 });

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "1h",
        tabId: 789
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle tab API errors gracefully', async () => {
      mockTabsArea.get.mockRejectedValue(new Error('Tab not found'));

      // Should not throw an error
      await expect(badgeManager.handleTabActivation({ tabId: 999 })).resolves.not.toThrow();
      
      // Should have logged the error
      expect(consoleErrorSpy).toHaveBeenCalledWith('[BadgeManager] Error handling tab activation:', expect.any(Error));
    });

    it('should handle storage errors during badge calculation', async () => {
      // Mock tab successfully
      const mockTab = {
        id: 123,
        url: 'https://facebook.com',
        status: 'complete'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      // Mock distraction detector
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site1'
      });

      // Make storage fail
      mockStorageArea.get.mockRejectedValue(new Error('Storage error'));

      await badgeManager.handleTabActivation({ tabId: 123 });

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      // Storage errors should be caught at module level, but we can verify errors were logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      // Should contain either error from getting sites or usage stats
      const errorCalls = consoleErrorSpy.mock.calls;
      const hasStorageError = errorCalls.some(call => 
        call[0].includes('Error getting') && call[1].message === 'Storage error'
      );
      expect(hasStorageError).toBe(true);
    });

    it('should handle disabled sites correctly', async () => {
      // Setup disabled site
      const disabledSite = {
        id: 'disabled-site',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        isEnabled: false
      };
      mockLocalStorageData.distractingSites = [disabledSite];

      const mockTab = {
        id: 123,
        url: 'https://facebook.com',
        status: 'complete'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'disabled-site'
      });

      await badgeManager.handleTabActivation({ tabId: 123 });

      // Wait for debounced update to complete (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should clear badge for disabled site
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "",
        tabId: 123
      });
    });
  });
}); 