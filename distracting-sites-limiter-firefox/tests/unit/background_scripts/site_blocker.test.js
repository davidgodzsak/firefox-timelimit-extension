/**
 * @file site_blocker.test.js
 * @description Unit tests for the site_blocker.js module.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the storage modules
const mockGetDistractingSites = jest.fn();
const mockGetUsageStats = jest.fn();

jest.unstable_mockModule('../../../background_scripts/site_storage.js', () => ({
  getDistractingSites: mockGetDistractingSites,
}));
jest.unstable_mockModule('../../../background_scripts/usage_storage.js', () => ({
  getUsageStats: mockGetUsageStats,
}));


// Mock the browser API
global.browser = {
  runtime: {
    getURL: jest.fn(path => `moz-extension://extension-id/${path}`),
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


describe('site_blocker.js', () => {
  beforeEach(async () => {
    jest.resetModules();

    // Re-import the module to get a fresh state for functions
    const siteBlockerModule = await import('../../../background_scripts/site_blocker.js');
    checkAndBlockSite = siteBlockerModule.checkAndBlockSite;
    handlePotentialRedirect = siteBlockerModule.handlePotentialRedirect;
    
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
      isEnabled: true
    },
    {
      id: 'site2',
      urlPattern: 'disabled-site.com',
      dailyLimitSeconds: 1800,
      isEnabled: false
    }
  ];

  describe('checkAndBlockSite', () => {
    it('should return shouldBlock: false for invalid parameters', async () => {
      const result = await checkAndBlockSite(null, null);
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null
      });
    });

    it('should return shouldBlock: false for non-matching URLs', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({});

      const result = await checkAndBlockSite('tab1', 'http://nonmatching.com');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null
      });
    });

    it('should return shouldBlock: false for disabled sites', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({});

      const result = await checkAndBlockSite('tab1', 'http://disabled-site.com');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null
      });
    });

    it('should return shouldBlock: false when under time limit', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 1800, opens: 5 } // 30 minutes
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: 'site1',
        reason: null
      });
    });

    it('should return shouldBlock: true when time limit exceeded', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);
      mockGetUsageStats.mockResolvedValue({
        site1: { timeSpentSeconds: 4000, opens: 10 } // > 1 hour
      });

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: true,
        siteId: 'site1',
        reason: "You've spent 67 minutes on this site today, exceeding your 60 minute limit."
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockGetDistractingSites.mockRejectedValue(new Error('Storage error'));

      const result = await checkAndBlockSite('tab1', 'http://example.com');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null
      });
    });

    it('should handle invalid URLs gracefully', async () => {
      mockGetDistractingSites.mockResolvedValue(sampleSites);

      const result = await checkAndBlockSite('tab1', 'invalid-url');
      expect(result).toEqual({
        shouldBlock: false,
        siteId: null,
        reason: null
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
    it('should not redirect when site should not be blocked', async () => {
      mockGetDistractingSites.mockResolvedValue([
        {
          id: '123',
          urlPattern: 'example.com',
          isEnabled: true,
          dailyLimitSeconds: 3600
        }
      ]);

      mockGetUsageStats.mockResolvedValue({
        '123': {
          timeSpentSeconds: 1800, // Under limit
          opens: 5
        }
      });

      const wasRedirected = await handlePotentialRedirect('tab1', 'https://example.com');
      expect(wasRedirected).toBe(false);
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });

    it('should redirect when site should be blocked', async () => {
      const siteId = '123';
      const blockedUrl = 'https://example.com';
      
      mockGetDistractingSites.mockResolvedValue([
        {
          id: siteId,
          urlPattern: 'example.com',
          isEnabled: true,
          dailyLimitSeconds: 3600
        }
      ]);

      mockGetUsageStats.mockResolvedValue({
        [siteId]: {
          timeSpentSeconds: 4000, // Over limit
          opens: 5
        }
      });

      const wasRedirected = await handlePotentialRedirect('tab1', blockedUrl);
      
      expect(wasRedirected).toBe(true);
      expect(browser.runtime.getURL).toHaveBeenCalledWith('ui/timeout/timeout.html');
      expect(browser.tabs.update).toHaveBeenCalledWith('tab1', {
        url: expect.stringContaining('timeout.html')
      });

      // Verify URL parameters
      const updateCall = browser.tabs.update.mock.calls[0];
      const redirectUrl = new URL(updateCall[1].url);
      expect(redirectUrl.searchParams.get('blockedUrl')).toBe(blockedUrl);
      expect(redirectUrl.searchParams.get('siteId')).toBe(siteId);
      expect(redirectUrl.searchParams.get('reason')).toBeTruthy();
    });

    it('should handle errors gracefully', async () => {
      mockGetDistractingSites.mockRejectedValue(new Error('Storage error'));

      const wasRedirected = await handlePotentialRedirect('tab1', 'https://example.com');
      expect(wasRedirected).toBe(false);
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });
  });
}); 