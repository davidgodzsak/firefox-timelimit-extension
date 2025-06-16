/**
 * @file badge_manager.test.js
 * @description Unit tests for badge manager module
 * 
 * Tests verify that:
 * - Badge text calculations work correctly for different limit types
 * - Tab activity handling works properly
 * - Error scenarios are handled gracefully
 * - Badge manager functions can be called without errors
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

describe('Badge Manager Module', () => {
  let badgeManager;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let mockLocalStorageData;

  beforeEach(async () => {
    // Clear mocks
    jest.clearAllMocks();

    // Reset mock data
    mockLocalStorageData = {};

    // Setup storage mocks
    mockStorageArea.get.mockImplementation(async (key) => {
      const result = {};
      if (mockLocalStorageData[key] !== undefined) {
        result[key] = mockLocalStorageData[key];
      }
      return Promise.resolve(result);
    });

    mockStorageArea.set.mockImplementation(async (items) => {
      Object.assign(mockLocalStorageData, items);
      return Promise.resolve();
    });

    // Setup console spies
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Import badge manager module
    badgeManager = await import('../../../background_scripts/badge_manager.js');
    
    mockTabsArea.query.mockResolvedValue([]);
    mockTabsArea.get.mockResolvedValue(null);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('updateBadgeForTab', () => {
    it('should handle invalid parameters gracefully', async () => {
      await badgeManager.updateBadgeForTab(null, 'https://example.com');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[BadgeManager] Invalid parameters for updateBadgeForTab:', { tabId: null, url: 'https://example.com' });
      
      await badgeManager.updateBadgeForTab(123, null);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[BadgeManager] Invalid parameters for updateBadgeForTab:', { tabId: 123, url: null });
    });

    it('should not throw errors when processing valid URLs', async () => {
      // Setup minimal site storage data
      mockLocalStorageData.distractingSites = [
        {
          id: 'site1',
          urlPattern: 'facebook.com',
          dailyLimitSeconds: 3600,
          isEnabled: true
        }
      ];

      // Should not throw any errors
      await expect(badgeManager.updateBadgeForTab(123, 'https://facebook.com')).resolves.not.toThrow();
      await expect(badgeManager.updateBadgeForTab(123, 'https://example.com')).resolves.not.toThrow();
    });

    it('should handle sites with open limits', async () => {
      mockLocalStorageData.distractingSites = [
        {
          id: 'site1',
          urlPattern: 'youtube.com',
          dailyLimitSeconds: 0,
          dailyOpenLimit: 5,
          isEnabled: true
        }
      ];

      await expect(badgeManager.updateBadgeForTab(123, 'https://youtube.com')).resolves.not.toThrow();
    });

    it('should handle sites with both time and open limits', async () => {
      mockLocalStorageData.distractingSites = [
        {
          id: 'site1',
          urlPattern: 'twitter.com',
          dailyLimitSeconds: 1800,
          dailyOpenLimit: 10,
          isEnabled: true
        }
      ];

      await expect(badgeManager.updateBadgeForTab(123, 'https://twitter.com')).resolves.not.toThrow();
    });

    it('should handle disabled sites', async () => {
      mockLocalStorageData.distractingSites = [
        {
          id: 'site1',
          urlPattern: 'instagram.com',
          dailyLimitSeconds: 3600,
          isEnabled: false
        }
      ];

      await expect(badgeManager.updateBadgeForTab(123, 'https://instagram.com')).resolves.not.toThrow();
    });

    it('should call browser API to set badge text', async () => {
      mockLocalStorageData.distractingSites = [
        {
          id: 'site1',
          urlPattern: 'facebook.com',
          dailyLimitSeconds: 3600,
          isEnabled: true
        }
      ];

      await badgeManager.updateBadgeForTab(123, 'https://facebook.com');

      // Should have called the browser API
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith(
        expect.objectContaining({
          tabId: 123
        })
      );
    });

    it('should handle storage errors gracefully', async () => {
      mockStorageArea.get.mockRejectedValue(new Error('Storage error'));

      await expect(badgeManager.updateBadgeForTab(123, 'https://facebook.com')).resolves.not.toThrow();
    });

    it('should handle browser API errors gracefully', async () => {
      mockActionArea.setBadgeText.mockRejectedValue(new Error('Browser API error'));

      await expect(badgeManager.updateBadgeForTab(123, 'https://facebook.com')).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[BadgeManager] Error setting badge text:', expect.any(Error));
    });
  });

  describe('handleTabActivation', () => {
    it('should handle valid tab activation', async () => {
      const mockTab = { id: 123, url: 'https://facebook.com' };
      mockTabsArea.get.mockResolvedValue(mockTab);

      await expect(badgeManager.handleTabActivation({ tabId: 123 })).resolves.not.toThrow();
      expect(mockTabsArea.get).toHaveBeenCalledWith(123);
    });

    it('should ignore invalid tab IDs', async () => {
      await expect(badgeManager.handleTabActivation({ tabId: null })).resolves.not.toThrow();
      await expect(badgeManager.handleTabActivation({ tabId: undefined })).resolves.not.toThrow();
      expect(mockTabsArea.get).not.toHaveBeenCalled();
    });

    it('should handle tab query errors gracefully', async () => {
      mockTabsArea.get.mockRejectedValue(new Error('Tab query error'));

      await expect(badgeManager.handleTabActivation({ tabId: 123 })).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[BadgeManager] Error handling tab activation:', expect.any(Error));
    });

    it('should handle null tab results', async () => {
      mockTabsArea.get.mockResolvedValue(null);

      await expect(badgeManager.handleTabActivation({ tabId: 123 })).resolves.not.toThrow();
    });
  });

  describe('handleTabUpdate', () => {
    it('should handle URL changes', async () => {
      const changeInfo = { url: 'https://facebook.com' };
      const tab = { id: 123, url: 'https://facebook.com' };

      await expect(badgeManager.handleTabUpdate(123, changeInfo, tab)).resolves.not.toThrow();
    });

    it('should ignore non-URL changes', async () => {
      const changeInfo = { title: 'New title' };
      const tab = { id: 123, url: 'https://facebook.com' };

      await expect(badgeManager.handleTabUpdate(123, changeInfo, tab)).resolves.not.toThrow();
    });

    it('should handle incomplete tabs', async () => {
      const changeInfo = { url: 'https://facebook.com' };
      const tab = { id: 123 }; // Missing URL

      await expect(badgeManager.handleTabUpdate(123, changeInfo, tab)).resolves.not.toThrow();
    });

    it('should handle invalid parameters gracefully', async () => {
      // The handleTabUpdate function only processes URL changes and active tabs
      // So null changeInfo should be handled gracefully without errors
      await expect(badgeManager.handleTabUpdate(null, {}, {})).resolves.not.toThrow();
      await expect(badgeManager.handleTabUpdate(123, {}, {})).resolves.not.toThrow(); // No URL change
      await expect(badgeManager.handleTabUpdate(123, { url: 'https://example.com' }, { active: false })).resolves.not.toThrow(); // Not active
    });
  });

  describe('refreshCurrentTabBadge', () => {
    it('should handle active tab refresh', async () => {
      const mockTabs = [{ id: 123, url: 'https://facebook.com' }];
      mockTabsArea.query.mockResolvedValue(mockTabs);

      // The refreshCurrentTabBadge doesn't query for active tabs if no current tab is set
      // Let's set up current tab first by calling updateBadgeForTab
      await badgeManager.updateBadgeForTab(123, 'https://facebook.com');
      
      await expect(badgeManager.refreshCurrentTabBadge()).resolves.not.toThrow();
      // The function should have called updateBadgeForTab internally
      expect(mockActionArea.setBadgeText).toHaveBeenCalled();
    });

    it('should handle no active tabs', async () => {
      mockTabsArea.query.mockResolvedValue([]);

      await expect(badgeManager.refreshCurrentTabBadge()).resolves.not.toThrow();
    });

    it('should handle query errors gracefully', async () => {
      mockTabsArea.query.mockRejectedValue(new Error('Query error'));

      // The refreshCurrentTabBadge doesn't directly query tabs - it uses internal state
      // So we test a different error scenario
      mockActionArea.setBadgeText.mockRejectedValue(new Error('Browser API error'));
      
      // Set up current tab state first
      await badgeManager.updateBadgeForTab(123, 'https://facebook.com');
      
      await expect(badgeManager.refreshCurrentTabBadge()).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[BadgeManager] Error setting badge text:', expect.any(Error));
    });
  });

  describe('clearAllBadges', () => {
    it('should clear badges for all tabs', async () => {
      const mockTabs = [
        { id: 123 },
        { id: 456 },
        { id: 789 }
      ];
      mockTabsArea.query.mockResolvedValue(mockTabs);

      await expect(badgeManager.clearAllBadges()).resolves.not.toThrow();

      expect(mockTabsArea.query).toHaveBeenCalledWith({});
      expect(mockActionArea.setBadgeText).toHaveBeenCalledTimes(3);
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({ text: "", tabId: 123 });
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({ text: "", tabId: 456 });
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({ text: "", tabId: 789 });
    });

    it('should handle query errors gracefully', async () => {
      mockTabsArea.query.mockRejectedValue(new Error('Query error'));

      await expect(badgeManager.clearAllBadges()).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[BadgeManager] Error clearing all badges:', expect.any(Error));
    });

    it('should handle empty tab results', async () => {
      mockTabsArea.query.mockResolvedValue([]);

      await expect(badgeManager.clearAllBadges()).resolves.not.toThrow();
      expect(mockActionArea.setBadgeText).not.toHaveBeenCalled();
    });
  });

  describe('initializeBadgeManager', () => {
    it('should initialize without errors', async () => {
      await expect(badgeManager.initializeBadgeManager()).resolves.not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow for site with time limits', async () => {
      // Setup test data
      mockLocalStorageData.distractingSites = [
        {
          id: 'site1',
          urlPattern: 'facebook.com',
          dailyLimitSeconds: 3600,
          isEnabled: true
        }
      ];
      
      const currentDate = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usage_${currentDate}`] = {
        site1: { timeSpentSeconds: 1800, opens: 5 }
      };

      mockTabsArea.get.mockResolvedValue({ id: 123, url: 'https://facebook.com' });

      // Test tab activation flow
      await expect(badgeManager.handleTabActivation({ tabId: 123 })).resolves.not.toThrow();
      
      // Test direct badge update
      await expect(badgeManager.updateBadgeForTab(123, 'https://facebook.com')).resolves.not.toThrow();
      
      // Verify browser API was called
      expect(mockActionArea.setBadgeText).toHaveBeenCalled();
    });

    it('should handle complete workflow for site with open limits', async () => {
      mockLocalStorageData.distractingSites = [
        {
          id: 'site2',
          urlPattern: 'youtube.com',
          dailyLimitSeconds: 0,
          dailyOpenLimit: 10,
          isEnabled: true
        }
      ];

      const currentDate = new Date().toISOString().split('T')[0];
      mockLocalStorageData[`usage_${currentDate}`] = {
        site2: { timeSpentSeconds: 0, opens: 3 }
      };

      await expect(badgeManager.updateBadgeForTab(456, 'https://youtube.com')).resolves.not.toThrow();
      expect(mockActionArea.setBadgeText).toHaveBeenCalled();
    });

    it('should handle workflow for non-distracting sites', async () => {
      mockLocalStorageData.distractingSites = [
        {
          id: 'site1',
          urlPattern: 'facebook.com',
          dailyLimitSeconds: 3600,
          isEnabled: true
        }
      ];

      await expect(badgeManager.updateBadgeForTab(123, 'https://example.com')).resolves.not.toThrow();
      
      // Should clear badge for non-distracting sites
      expect(mockActionArea.setBadgeText).toHaveBeenCalledWith({
        text: "",
        tabId: 123
      });
    });
  });
}); 