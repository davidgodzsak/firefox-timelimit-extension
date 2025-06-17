/**
 * @file badge_manager.test.js
 * @description Unit tests for the simplified badge manager module
 * Tests the main updateBadge(tabId) function that fetches data from storage
 * and updates badge text based on current usage and limits.
 */

import { jest } from '@jest/globals';

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

// Create mock modules
const mockSiteStorage = {
  getDistractingSites: jest.fn()
};

const mockUsageStorage = {
  getUsageStats: jest.fn()
};

const mockDistractionDetector = {
  checkIfUrlIsDistracting: jest.fn()
};

// Mock the modules before importing
jest.unstable_mockModule('../../../background_scripts/site_storage.js', () => mockSiteStorage);
jest.unstable_mockModule('../../../background_scripts/usage_storage.js', () => mockUsageStorage);
jest.unstable_mockModule('../../../background_scripts/distraction_detector.js', () => mockDistractionDetector);

describe('BadgeManager', () => {
  let badgeManager;
  let consoleSpy;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup console spy
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();

    // Import the module fresh each time
    jest.resetModules();
    badgeManager = await import('../../../background_scripts/badge_manager.js');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('module loading', () => {
    test('should load badge manager module with core functions', () => {
      expect(badgeManager).toBeDefined();
      expect(badgeManager.updateBadge).toBeDefined();
      expect(badgeManager.clearBadge).toBeDefined();
    });
  });

  describe('updateBadge function', () => {
    test('should handle invalid tabId gracefully', async () => {
      await badgeManager.updateBadge(null);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[BadgeManager] Invalid tabId provided to updateBadge:',
        null
      );
    });

    test('should handle tab not found error gracefully', async () => {
      mockTabsArea.get.mockRejectedValue(new Error('Tab not found'));

      await expect(badgeManager.updateBadge(123)).resolves.not.toThrow();
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "",
        tabId: 123
      });
    });

    test('should clear badge for internal pages', async () => {
      const mockTab = {
        id: 123,
        url: 'chrome://settings/'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await badgeManager.updateBadge(123);

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "",
        tabId: 123
      });
    });

    test('should clear badge for non-distracting sites', async () => {
      const mockTab = {
        id: 123,
        url: 'https://example.com'
      };
      mockTabsArea.get.mockResolvedValue(mockTab);
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: false,
        siteId: null
      });

      await badgeManager.updateBadge(123);

      expect(mockDistractionDetector.checkIfUrlIsDistracting).toHaveBeenCalledWith('https://example.com');
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "",
        tabId: 123
      });
    });

    test('should update badge for distracting site with time limit', async () => {
      const mockTab = {
        id: 123,
        url: 'https://facebook.com'
      };
      const mockSite = {
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600, // 1 hour
        isEnabled: true
      };
      const mockUsageStats = {
        site1: { timeSpentSeconds: 1800, opens: 3 } // 30 minutes used
      };

      mockTabsArea.get.mockResolvedValue(mockTab);
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site1'
      });
      mockSiteStorage.getDistractingSites.mockResolvedValue({
        success: true,
        data: [mockSite]
      });
      mockUsageStorage.getUsageStats.mockResolvedValue({
        success: true,
        data: mockUsageStats
      });

      await badgeManager.updateBadge(123);

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "30m", // 30 minutes remaining
        tabId: 123
      });
      expect(mockActionArea.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: [0, 122, 255, 255],
        tabId: 123
      });
    });

    test('should update badge for distracting site with open limit', async () => {
      const mockTab = {
        id: 123,
        url: 'https://youtube.com'
      };
      const mockSite = {
        id: 'site2',
        urlPattern: 'youtube.com',
        dailyOpenLimit: 10,
        isEnabled: true
      };
      const mockUsageStats = {
        site2: { timeSpentSeconds: 1200, opens: 7 } // 7 opens used
      };

      mockTabsArea.get.mockResolvedValue(mockTab);
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site2'
      });
      mockSiteStorage.getDistractingSites.mockResolvedValue({
        success: true,
        data: [mockSite]
      });
      mockUsageStorage.getUsageStats.mockResolvedValue({
        success: true,
        data: mockUsageStats
      });

      await badgeManager.updateBadge(123);

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "3", // 3 opens remaining
        tabId: 123
      });
    });

    test('should update badge for distracting site with both limits', async () => {
      const mockTab = {
        id: 123,
        url: 'https://reddit.com'
      };
      const mockSite = {
        id: 'site3',
        urlPattern: 'reddit.com',
        dailyLimitSeconds: 1800, // 30 minutes
        dailyOpenLimit: 5,
        isEnabled: true
      };
      const mockUsageStats = {
        site3: { timeSpentSeconds: 600, opens: 2 } // 10 minutes used, 2 opens used
      };

      mockTabsArea.get.mockResolvedValue(mockTab);
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site3'
      });
      mockSiteStorage.getDistractingSites.mockResolvedValue({
        success: true,
        data: [mockSite]
      });
      mockUsageStorage.getUsageStats.mockResolvedValue({
        success: true,
        data: mockUsageStats
      });

      await badgeManager.updateBadge(123);

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "20m/3", // 20 minutes remaining / 3 opens remaining
        tabId: 123
      });
    });

    test('should handle site storage fetch failure', async () => {
      const mockTab = {
        id: 123,
        url: 'https://facebook.com'
      };

      mockTabsArea.get.mockResolvedValue(mockTab);
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site1'
      });
      mockSiteStorage.getDistractingSites.mockRejectedValue(new Error('Storage error'));

      await badgeManager.updateBadge(123);

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "",
        tabId: 123
      });
    });

    test('should handle usage storage fetch failure gracefully', async () => {
      const mockTab = {
        id: 123,
        url: 'https://facebook.com'
      };
      const mockSite = {
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        isEnabled: true
      };

      mockTabsArea.get.mockResolvedValue(mockTab);
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({
        isMatch: true,
        siteId: 'site1'
      });
      mockSiteStorage.getDistractingSites.mockResolvedValue({
        success: true,
        data: [mockSite]
      });
      mockUsageStorage.getUsageStats.mockRejectedValue(new Error('Usage storage error'));

      await badgeManager.updateBadge(123);

      // Should still update badge with full limit (no usage data)
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "1h", // Full 1 hour limit
        tabId: 123
      });
    });
  });

  describe('clearBadge function', () => {
    test('should handle invalid tabId gracefully', async () => {
      await badgeManager.clearBadge(null);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[BadgeManager] Invalid tabId provided to clearBadge:',
        null
      );
    });

    test('should clear badge text successfully', async () => {
      await badgeManager.clearBadge(123);

      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "",
        tabId: 123
      });
    });

    test('should handle badge clearing errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockActionArea.setBadgeText.mockRejectedValue(new Error('Badge error'));

      await expect(badgeManager.clearBadge(123)).resolves.not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith('[BadgeManager] Error clearing badge:', expect.any(Error));
      
      errorSpy.mockRestore();
    });
  });
}); 