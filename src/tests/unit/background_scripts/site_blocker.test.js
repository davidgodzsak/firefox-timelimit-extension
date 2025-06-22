/**
 * @file site_blocker.test.js
 * @description Unit tests for the site_blocker.js module.
 * Updated for event-driven architecture with webNavigation integration.
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock the storage modules
const mockGetDistractingSites = jest.fn();
const mockGetUsageStats = jest.fn();

jest.unstable_mockModule('../../../background_scripts/site_storage.js', () => ({
  getDistractingSites: mockGetDistractingSites,
}));
jest.unstable_mockModule(
  '../../../background_scripts/usage_storage.js',
  () => ({
    getUsageStats: mockGetUsageStats,
  })
);

// Mock the browser API
global.browser = {
  runtime: {
    getURL: jest.fn((path) => `moz-extension://extension-id/${path}`),
  },
  tabs: {
    update: jest.fn(),
  },
};

// Mock Date for consistent testing
const mockDate = new Date('2024-03-14T12:00:00Z');
const originalDate = global.Date;

// To be imported in beforeEach
let checkAndBlockSite;
let handlePotentialRedirect;
let checkOpenLimitBeforeAccess;

describe('site_blocker.js', () => {
  beforeEach(async () => {
    jest.resetModules();

    // Re-import the module to get a fresh state for functions
    const siteBlockerModule = await import(
      '../../../background_scripts/site_blocker.js'
    );
    checkAndBlockSite = siteBlockerModule.checkAndBlockSite;
    handlePotentialRedirect = siteBlockerModule.handlePotentialRedirect;
    checkOpenLimitBeforeAccess = siteBlockerModule.checkOpenLimitBeforeAccess;

    // Reset all mocks
    mockGetDistractingSites.mockReset();
    mockGetUsageStats.mockReset();
    browser.tabs.update.mockReset();
    browser.runtime.getURL.mockClear();

    // Mock Date to return our fixed date
    global.Date = jest.fn(() => mockDate);
    global.Date.now = jest.fn(() => mockDate.getTime());
  });

  afterEach(() => {
    // Restore original Date
    global.Date = originalDate;
  });

  const sampleSites = [
    {
      id: 'site1',
      urlPattern: 'example.com',
      dailyLimitSeconds: 3600, // 1 hour
      isEnabled: true,
    },
    {
      id: 'site2',
      urlPattern: 'disabled-site.com',
      dailyLimitSeconds: 1800,
      isEnabled: false,
    },
  ];

  describe('checkAndBlockSite', () => {
    it('should return shouldBlock: false for invalid parameters', async () => {
      const result = await checkAndBlockSite(null, null);
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null,
        limitType: null,
      });
    });

    it('should return shouldBlock: false for invalid URL parameter type', async () => {
      const result = await checkAndBlockSite(123, 456); // URL should be string
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null,
        limitType: null,
      });
    });

    it('should handle string tabId from navigation events', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({});

      const result = await checkAndBlockSite('123', 'http://nonmatching.com'); // string tabId
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null,
        limitType: null,
      });
    });

    it('should handle numeric tabId from navigation events', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({});

      const result = await checkAndBlockSite(123, 'http://nonmatching.com'); // numeric tabId
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null,
        limitType: null,
      });
    });

    it('should return shouldBlock: false for non-matching URLs', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({});

      const result = await checkAndBlockSite('tab1', 'http://nonmatching.com');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null,
        limitType: null,
      });
    });

    it('should return shouldBlock: false for disabled sites', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({});

      const result = await checkAndBlockSite(
        'tab1',
        'http://disabled-site.com'
      );
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null,
        limitType: null,
      });
    });

    it('should return shouldBlock: false when under time limit', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 5 }, // 30 minutes
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: 'site1',
        reason: null,
        limitType: null,
      });
    });

    it('should return shouldBlock: true when time limit exceeded', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 4000, opens: 10 }, // > 1 hour
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: true,
        siteId: 'site1',
        reason:
          "You've spent 67 minutes on this site today, exceeding your 60 minute limit.",
        limitType: 'time',
      });
    });

    it('should return shouldBlock: false when under open limit', async () => {
      const sitesWithOpenLimit = [
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyLimitSeconds: 99999, // Very high time limit
          dailyOpenLimit: 10,
          isEnabled: true,
        },
      ];

      mockGetDistractingSites.mockResolvedValue(sitesWithOpenLimit);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 5 }, // Under open limit
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: 'site1',
        reason: null,
        limitType: null,
      });
    });

    it('should return shouldBlock: true when open limit exceeded', async () => {
      const sitesWithOpenLimit = [
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyLimitSeconds: 99999, // Very high time limit
          dailyOpenLimit: 5,
          isEnabled: true,
        },
      ];

      mockGetDistractingSites.mockResolvedValue(sitesWithOpenLimit);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 8 }, // Over open limit
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: true,
        siteId: 'site1',
        reason:
          "You've opened this site 8 times today, exceeding your 5 open limit.",
        limitType: 'opens',
      });
    });

    it('should return shouldBlock: true when both limits exceeded', async () => {
      const sitesWithBothLimits = [
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyLimitSeconds: 3600, // 1 hour
          dailyOpenLimit: 5,
          isEnabled: true,
        },
      ];

      mockGetDistractingSites.mockResolvedValue(sitesWithBothLimits);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 4000, opens: 8 }, // Both limits exceeded
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: true,
        siteId: 'site1',
        reason:
          "You've exceeded both your time limit (67/60 minutes) and open limit (8/5 opens) for this site today.",
        limitType: 'both',
      });
    });

    it('should work with open-only limits (no time limit)', async () => {
      const sitesOpenOnly = [
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyLimitSeconds: 0, // No time limit
          dailyOpenLimit: 3,
          isEnabled: true,
        },
      ];

      mockGetDistractingSites.mockResolvedValue(sitesOpenOnly);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 5000, opens: 5 }, // Time doesn't matter, opens exceeded
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: true,
        siteId: 'site1',
        reason:
          "You've opened this site 5 times today, exceeding your 3 open limit.",
        limitType: 'opens',
      });
    });

    it('should prioritize time limit when only time limit exceeded', async () => {
      const sitesWithBothLimits = [
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyLimitSeconds: 3600, // 1 hour
          dailyOpenLimit: 10,
          isEnabled: true,
        },
      ];

      mockGetDistractingSites.mockResolvedValue(sitesWithBothLimits);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 4000, opens: 5 }, // Only time limit exceeded
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: true,
        siteId: 'site1',
        reason:
          "You've spent 67 minutes on this site today, exceeding your 60 minute limit.",
        limitType: 'time',
      });
    });

    it('should handle sites without open limits gracefully', async () => {
      const sitesTimeOnly = [
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyLimitSeconds: 3600, // 1 hour
          // No dailyOpenLimit property
          isEnabled: true,
        },
      ];

      mockGetDistractingSites.mockResolvedValue(sitesTimeOnly);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 100 }, // Many opens but no limit
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: 'site1',
        reason: null,
        limitType: null,
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockGetDistractingSites.mockRejectedValue(new Error('Storage error'));

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null,
        limitType: null,
      });
    });

    it('should handle invalid URLs gracefully', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);

      const result = await checkAndBlockSite('tab1', 'invalid-url');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null,
        limitType: null,
      });
    });

    it('should use correct date format for storage', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({});

      await checkAndBlockSite('tab1', 'http://example.com');

      expect(mockGetUsageStats).toHaveBeenCalledWith('2024-03-14');
    });
  });

  describe('handlePotentialRedirect', () => {
    it('should redirect tab when site should be blocked', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 4000, opens: 10 }, // Over time limit
      });

      const result = await handlePotentialRedirect(123, 'http://example.com');

      expect(result).toBe(true);
      expect(browser.tabs.update).toHaveBeenCalledWith(123, {
        url: expect.stringContaining('ui/timeout/timeout.html'),
      });
    });

    it('should not redirect tab when site should not be blocked', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 5 }, // Under limits
      });

      const result = await handlePotentialRedirect(123, 'http://example.com');

      expect(result).toBe(false);
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });

    it('should handle redirection errors gracefully', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 4000, opens: 10 }, // Over limits
      });
      browser.tabs.update.mockRejectedValue(new Error('Tab update failed'));

      const result = await handlePotentialRedirect(123, 'http://example.com');

      expect(result).toBe(false);
    });

    it('should include correct URL parameters in timeout redirect', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 4000, opens: 10 }, // Over time limit
      });

      await handlePotentialRedirect(123, 'http://example.com/page');

      expect(browser.tabs.update).toHaveBeenCalledWith(123, {
        url: expect.stringMatching(
          /blockedUrl=http%3A%2F%2Fexample\.com%2Fpage/
        ),
      });
      expect(browser.tabs.update).toHaveBeenCalledWith(123, {
        url: expect.stringMatching(/siteId=site1/),
      });
      expect(browser.tabs.update).toHaveBeenCalledWith(123, {
        url: expect.stringMatching(/limitType=time/),
      });
    });
  });

  describe('checkOpenLimitBeforeAccess', () => {
    it('should return wouldExceed: false for invalid URL', async () => {
      const result = await checkOpenLimitBeforeAccess('');
      expect(result).toEqual({
        wouldExceed: false,
        siteId: null,
        currentOpens: 0,
        limit: 0,
      });
    });

    it('should return wouldExceed: false for non-matching URLs', async () => {
      mockGetDistractingSites.mockResolvedValue([
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyOpenLimit: 5,
          isEnabled: true,
        },
      ]);

      const result = await checkOpenLimitBeforeAccess('http://nonmatching.com');
      expect(result).toEqual({
        wouldExceed: false,
        siteId: null,
        currentOpens: 0,
        limit: 0,
      });
    });

    it('should return wouldExceed: false for sites without open limits', async () => {
      mockGetDistractingSites.mockResolvedValue([
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyLimitSeconds: 3600,
          // No dailyOpenLimit
          isEnabled: true,
        },
      ]);

      const result = await checkOpenLimitBeforeAccess('http://example.com');
      expect(result).toEqual({
        wouldExceed: false,
        siteId: null,
        currentOpens: 0,
        limit: 0,
      });
    });

    it('should return wouldExceed: false for disabled sites', async () => {
      mockGetDistractingSites.mockResolvedValue([
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyOpenLimit: 5,
          isEnabled: false,
        },
      ]);

      const result = await checkOpenLimitBeforeAccess('http://example.com');
      expect(result).toEqual({
        wouldExceed: false,
        siteId: null,
        currentOpens: 0,
        limit: 0,
      });
    });

    it('should return wouldExceed: false when well under limit', async () => {
      mockGetDistractingSites.mockResolvedValue([
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyOpenLimit: 10,
          isEnabled: true,
        },
      ]);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 3 },
      });

      const result = await checkOpenLimitBeforeAccess('http://example.com');
      expect(result).toEqual({
        wouldExceed: false,
        siteId: 'site1',
        currentOpens: 3,
        limit: 10,
      });
    });

    it('should return wouldExceed: false when at limit but not exceeding', async () => {
      mockGetDistractingSites.mockResolvedValue([
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyOpenLimit: 5,
          isEnabled: true,
        },
      ]);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 4 }, // One more would reach limit
      });

      const result = await checkOpenLimitBeforeAccess('http://example.com');
      expect(result).toEqual({
        wouldExceed: false,
        siteId: 'site1',
        currentOpens: 4,
        limit: 5,
      });
    });

    it('should return wouldExceed: true when one more open would exceed limit', async () => {
      mockGetDistractingSites.mockResolvedValue([
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyOpenLimit: 5,
          isEnabled: true,
        },
      ]);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 5 }, // At limit, one more would exceed
      });

      const result = await checkOpenLimitBeforeAccess('http://example.com');
      expect(result).toEqual({
        wouldExceed: true,
        siteId: 'site1',
        currentOpens: 5,
        limit: 5,
      });
    });

    it('should return wouldExceed: true when already over limit', async () => {
      mockGetDistractingSites.mockResolvedValue([
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyOpenLimit: 3,
          isEnabled: true,
        },
      ]);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 5 }, // Already over limit
      });

      const result = await checkOpenLimitBeforeAccess('http://example.com');
      expect(result).toEqual({
        wouldExceed: true,
        siteId: 'site1',
        currentOpens: 5,
        limit: 3,
      });
    });

    it('should handle missing usage data gracefully', async () => {
      mockGetDistractingSites.mockResolvedValue([
        {
          id: 'site1',
          urlPattern: 'example.com',
          dailyOpenLimit: 5,
          isEnabled: true,
        },
      ]);
      mockGetUsageStats.mockResolvedValue({}); // No usage data

      const result = await checkOpenLimitBeforeAccess('http://example.com');
      expect(result).toEqual({
        wouldExceed: false,
        siteId: 'site1',
        currentOpens: 0,
        limit: 5,
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockGetDistractingSites.mockRejectedValue(new Error('Storage error'));

      const result = await checkOpenLimitBeforeAccess('http://example.com');
      expect(result).toEqual({
        wouldExceed: false,
        siteId: null,
        currentOpens: 0,
        limit: 0,
      });
    });
  });
});
