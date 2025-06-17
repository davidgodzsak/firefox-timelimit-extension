/**
 * @file site_blocking_integration.test.js
 * @description Integration tests for the event-driven site blocking system.
 * Tests the flow from webNavigation.onBeforeNavigate events to site blocking redirects.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock storage modules
const mockGetDistractingSites = jest.fn();
const mockGetUsageStats = jest.fn();

jest.unstable_mockModule('../../background_scripts/site_storage.js', () => ({
  getDistractingSites: mockGetDistractingSites,
}));
jest.unstable_mockModule('../../background_scripts/usage_storage.js', () => ({
  getUsageStats: mockGetUsageStats,
}));

// Mock the daily reset module
jest.unstable_mockModule('../../background_scripts/daily_reset.js', () => ({
  initializeDailyResetAlarm: jest.fn().mockResolvedValue(),
  performDailyReset: jest.fn().mockResolvedValue(),
}));

// Mock browser API
const mockTabsUpdate = jest.fn();
const mockRuntimeGetURL = jest.fn();
const mockAlarmsOnAlarm = { addListener: jest.fn() };
const mockRuntimeOnInstalled = { addListener: jest.fn() };
const mockWebNavigationOnBeforeNavigate = { addListener: jest.fn() };

global.browser = {
  tabs: {
    update: mockTabsUpdate,
  },
  runtime: {
    getURL: mockRuntimeGetURL,
    onInstalled: mockRuntimeOnInstalled,
  },
  alarms: {
    onAlarm: mockAlarmsOnAlarm,
  },
  webNavigation: {
    onBeforeNavigate: mockWebNavigationOnBeforeNavigate,
  },
};

// Mock Date for consistent testing
const mockDate = new Date('2024-03-14T12:00:00Z');
const originalDate = global.Date;

let handleBeforeNavigateCallback;

describe('Site Blocking Integration', () => {
  beforeEach(async () => {
    jest.resetModules();
    
    // Reset all mocks
    mockGetDistractingSites.mockReset();
    mockGetUsageStats.mockReset();
    mockTabsUpdate.mockReset();
    mockRuntimeGetURL.mockReset();
    mockWebNavigationOnBeforeNavigate.addListener.mockReset();
    
    // Mock Date to return our fixed date
    global.Date = jest.fn(() => mockDate);
    global.Date.now = jest.fn(() => mockDate.getTime());
    
    // Set up default mocks
    mockRuntimeGetURL.mockImplementation(path => `moz-extension://test-id/${path}`);
    
    // Capture the navigation listener when background.js is imported
    mockWebNavigationOnBeforeNavigate.addListener.mockImplementation((callback) => {
      handleBeforeNavigateCallback = callback;
    });
    
    // Import background.js to set up event listeners
    await import('../../background_scripts/background.js');
  });

  afterEach(() => {
    // Restore original Date
    global.Date = originalDate;
  });

  const sampleSites = [
    {
      id: 'distracting-site',
      urlPattern: 'example.com',
      dailyLimitSeconds: 3600, // 1 hour
      dailyOpenLimit: 10,
      isEnabled: true
    },
    {
      id: 'time-only-site',
      urlPattern: 'timeonly.com',
      dailyLimitSeconds: 1800, // 30 minutes
      dailyOpenLimit: 0, // No open limit
      isEnabled: true
    },
    {
      id: 'disabled-site',
      urlPattern: 'disabled.com',
      dailyLimitSeconds: 3600,
      isEnabled: false
    }
  ];

  describe('webNavigation.onBeforeNavigate Integration', () => {
    it('should register the navigation event listener', () => {
      expect(mockWebNavigationOnBeforeNavigate.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
      expect(handleBeforeNavigateCallback).toBeDefined();
    });

    it('should ignore iframe navigations (frameId !== 0)', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        'distracting-site': { timeSpentSeconds: 4000, opens: 15 } // Over both limits
      });

      const navigationDetails = {
        tabId: 123,
        url: 'http://example.com',
        frameId: 1, // iframe navigation
        transitionType: 'auto_subframe'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should not attempt to block iframe navigations
      expect(mockTabsUpdate).not.toHaveBeenCalled();
    });

    it('should handle main frame navigation to non-distracting site', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({});

      const navigationDetails = {
        tabId: 123,
        url: 'http://non-distracting.com',
        frameId: 0, // main frame
        transitionType: 'typed'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should not block non-distracting sites
      expect(mockTabsUpdate).not.toHaveBeenCalled();
    });

    it('should allow navigation to distracting site under limits', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        'distracting-site': { timeSpentSeconds: 1800, opens: 5 } // Under both limits
      });

      const navigationDetails = {
        tabId: 123,
        url: 'http://example.com/page',
        frameId: 0,
        transitionType: 'typed'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should not block sites under limits
      expect(mockTabsUpdate).not.toHaveBeenCalled();
    });

    it('should block navigation when time limit exceeded', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        'distracting-site': { timeSpentSeconds: 4000, opens: 5 } // Over time limit
      });

      const navigationDetails = {
        tabId: 123,
        url: 'http://example.com/page',
        frameId: 0,
        transitionType: 'typed'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should redirect to timeout page
      expect(mockTabsUpdate).toHaveBeenCalledWith(123, {
        url: expect.stringContaining('ui/timeout/timeout.html')
      });

      // Verify URL parameters
      const redirectUrl = mockTabsUpdate.mock.calls[0][1].url;
      expect(redirectUrl).toMatch(/blockedUrl=http%3A%2F%2Fexample\.com%2Fpage/);
      expect(redirectUrl).toMatch(/siteId=distracting-site/);
      expect(redirectUrl).toMatch(/limitType=time/);
    });

    it('should block navigation when open limit exceeded', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        'distracting-site': { timeSpentSeconds: 1800, opens: 15 } // Over open limit
      });

      const navigationDetails = {
        tabId: 456,
        url: 'http://example.com',
        frameId: 0,
        transitionType: 'link'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should redirect to timeout page
      expect(mockTabsUpdate).toHaveBeenCalledWith(456, {
        url: expect.stringContaining('ui/timeout/timeout.html')
      });

      // Verify URL parameters show open limit exceeded
      const redirectUrl = mockTabsUpdate.mock.calls[0][1].url;
      expect(redirectUrl).toMatch(/limitType=opens/);
    });

    it('should block navigation when both limits exceeded', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        'distracting-site': { timeSpentSeconds: 4000, opens: 15 } // Over both limits
      });

      const navigationDetails = {
        tabId: 789,
        url: 'http://example.com',
        frameId: 0,
        transitionType: 'typed'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should redirect to timeout page
      expect(mockTabsUpdate).toHaveBeenCalledWith(789, {
        url: expect.stringContaining('ui/timeout/timeout.html')
      });

      // Verify URL parameters show both limits exceeded
      const redirectUrl = mockTabsUpdate.mock.calls[0][1].url;
      expect(redirectUrl).toMatch(/limitType=both/);
    });

    it('should ignore disabled distracting sites', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        'disabled-site': { timeSpentSeconds: 4000, opens: 15 } // Over limits but disabled
      });

      const navigationDetails = {
        tabId: 123,
        url: 'http://disabled.com',
        frameId: 0,
        transitionType: 'typed'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should not block disabled sites
      expect(mockTabsUpdate).not.toHaveBeenCalled();
    });

    it('should handle invalid navigation details gracefully', async () => {
      const invalidNavigationDetails = [
        { tabId: null, url: 'http://example.com', frameId: 0 },
        { tabId: 123, url: null, frameId: 0 },
        { tabId: 123, url: '', frameId: 0 },
        { frameId: 0 }, // missing tabId and url
      ];

      for (const details of invalidNavigationDetails) {
        await handleBeforeNavigateCallback(details);
      }

      // Should not attempt any redirections for invalid details
      expect(mockTabsUpdate).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      mockGetDistractingSites.mockRejectedValue(new Error('Storage unavailable'));

      const navigationDetails = {
        tabId: 123,
        url: 'http://example.com',
        frameId: 0,
        transitionType: 'typed'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should not block navigation on storage errors
      expect(mockTabsUpdate).not.toHaveBeenCalled();
    });

    it('should handle tab update errors gracefully', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        'distracting-site': { timeSpentSeconds: 4000, opens: 15 } // Over both limits
      });
      mockTabsUpdate.mockRejectedValue(new Error('Tab update failed'));

      const navigationDetails = {
        tabId: 123,
        url: 'http://example.com',
        frameId: 0,
        transitionType: 'typed'
      };

      // Should not throw error even if tab update fails
      await expect(handleBeforeNavigateCallback(navigationDetails)).resolves.not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed URLs in navigation', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);

      const navigationDetails = {
        tabId: 123,
        url: 'not-a-valid-url',
        frameId: 0,
        transitionType: 'typed'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should not crash on malformed URLs
      expect(mockTabsUpdate).not.toHaveBeenCalled();
    });

    it('should handle sites with no usage data', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({}); // No usage data for any site

      const navigationDetails = {
        tabId: 123,
        url: 'http://example.com',
        frameId: 0,
        transitionType: 'typed'
      };

      await handleBeforeNavigateCallback(navigationDetails);

      // Should not block sites with no usage data (under limits by default)
      expect(mockTabsUpdate).not.toHaveBeenCalled();
    });

    it('should handle concurrent navigation events', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        'distracting-site': { timeSpentSeconds: 4000, opens: 15 } // Over both limits
      });

      const navigationDetails1 = {
        tabId: 123,
        url: 'http://example.com/page1',
        frameId: 0,
        transitionType: 'typed'
      };

      const navigationDetails2 = {
        tabId: 456,
        url: 'http://example.com/page2',
        frameId: 0,
        transitionType: 'link'
      };

      // Fire both navigation events simultaneously
      await Promise.all([
        handleBeforeNavigateCallback(navigationDetails1),
        handleBeforeNavigateCallback(navigationDetails2)
      ]);

      // Both should be blocked
      expect(mockTabsUpdate).toHaveBeenCalledTimes(2);
      expect(mockTabsUpdate).toHaveBeenCalledWith(123, expect.any(Object));
      expect(mockTabsUpdate).toHaveBeenCalledWith(456, expect.any(Object));
    });
  });
}); 