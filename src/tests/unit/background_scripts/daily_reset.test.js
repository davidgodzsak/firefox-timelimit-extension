import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * @file daily_reset.test.js
 * @description Unit tests for daily_reset.js functionality.
 * Tests both alarm initialization and the daily reset operation.
 */

// Mock browser APIs
const mockAlarmsAPI = {
  create: jest.fn(),
  get: jest.fn(),
};

const mockStorageArea = {
  get: jest.fn(),
  remove: jest.fn(),
};

global.browser = {
  alarms: mockAlarmsAPI,
  storage: {
    local: mockStorageArea,
  },
};

// Mock usage_storage module
jest.unstable_mockModule('../../../background_scripts/usage_storage.js', () => ({
  getUsageStats: jest.fn(),
}));

const { getUsageStats } = await import('../../../background_scripts/usage_storage.js');
const { 
  initializeDailyResetAlarm, 
  performDailyReset 
} = await import('../../../background_scripts/daily_reset.js');

describe('daily_reset.js', () => {
  let consoleSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let mockStorageData;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Initialize mock storage data
    mockStorageData = {};
    
    // Mock storage.local.get to return mock data
    mockStorageArea.get.mockImplementation(async (key) => {
      if (key === null) {
        // Return all storage data
        return Promise.resolve(mockStorageData);
      }
      const result = {};
      if (Object.prototype.hasOwnProperty.call(mockStorageData, key)) {
        result[key] = mockStorageData[key];
      }
      return Promise.resolve(result);
    });
    
    // Mock storage.local.remove
    mockStorageArea.remove.mockImplementation(async (keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => delete mockStorageData[key]);
      return Promise.resolve();
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('initializeDailyResetAlarm', () => {
    it('should create alarm with correct parameters', async () => {
      const mockAlarm = {
        name: 'dailyResetAlarm',
        scheduledTime: Date.now() + 86400000 // 24 hours from now
      };
      
      mockAlarmsAPI.create.mockResolvedValueOnce(undefined);
      mockAlarmsAPI.get.mockResolvedValueOnce(mockAlarm);

      await initializeDailyResetAlarm();

      expect(mockAlarmsAPI.create).toHaveBeenCalledWith('dailyResetAlarm', {
        when: expect.any(Number),
        periodInMinutes: 24 * 60
      });
      
      expect(mockAlarmsAPI.get).toHaveBeenCalledWith('dailyResetAlarm');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DailyReset] Alarm "dailyResetAlarm" created/updated')
      );
    });

    it('should calculate next midnight correctly', async () => {
      mockAlarmsAPI.create.mockResolvedValueOnce(undefined);
      mockAlarmsAPI.get.mockResolvedValueOnce({ name: 'dailyResetAlarm', scheduledTime: Date.now() });

      await initializeDailyResetAlarm();

      const createCall = mockAlarmsAPI.create.mock.calls[0];
      const scheduledTime = createCall[1].when;
      const scheduledDate = new Date(scheduledTime);
      
      // Should be scheduled for midnight (00:00:00)
      expect(scheduledDate.getHours()).toBe(0);
      expect(scheduledDate.getMinutes()).toBe(0);
      expect(scheduledDate.getSeconds()).toBe(0);
      expect(scheduledDate.getMilliseconds()).toBe(0);
      
      // Should be tomorrow or later
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      expect(scheduledTime).toBeGreaterThanOrEqual(tomorrow.getTime());
    });

    it('should handle case when alarm cannot be retrieved after creation', async () => {
      mockAlarmsAPI.create.mockResolvedValueOnce(undefined);
      mockAlarmsAPI.get.mockResolvedValueOnce(null); // Alarm not found

      await initializeDailyResetAlarm();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DailyReset] Alarm "dailyResetAlarm" was scheduled, but could not be retrieved')
      );
    });

    it('should throw error when alarm creation fails', async () => {
      const error = new Error('Alarm creation failed');
      mockAlarmsAPI.create.mockRejectedValueOnce(error);

      await expect(initializeDailyResetAlarm()).rejects.toThrow('Alarm creation failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[DailyReset] Error creating/updating daily reset alarm:', error);
    });
  });

  describe('performDailyReset', () => {
    const today = '2023-12-25';
    const yesterday = '2023-12-24';
    const twoDaysAgo = '2023-12-23';

    beforeEach(() => {
      // Mock Date to return a fixed date for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-12-25T10:30:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should remove old usage statistics and preserve current day', async () => {
      // Set up mock storage with usage data from multiple days
      mockStorageData = {
        [`usageStats-${today}`]: { site1: { timeSpentSeconds: 100, opens: 2 } },
        [`usageStats-${yesterday}`]: { site2: { timeSpentSeconds: 200, opens: 3 } },
        [`usageStats-${twoDaysAgo}`]: { site3: { timeSpentSeconds: 150, opens: 1 } },
        'otherData': { someKey: 'someValue' }, // Non-usage data should be preserved
      };

      const currentDayStats = { site1: { timeSpentSeconds: 100, opens: 2 } };
      getUsageStats.mockResolvedValueOnce(currentDayStats);

      await performDailyReset();

      // Should remove old usage stats but keep current day and other data
      expect(mockStorageArea.remove).toHaveBeenCalledWith([
        `usageStats-${yesterday}`,
        `usageStats-${twoDaysAgo}`
      ]);
      
      // Verify current day stats were queried
      expect(getUsageStats).toHaveBeenCalledWith(today);
      
      // Check logging
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DailyReset] Starting daily reset process')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DailyReset] Removing 2 old usage statistics entries:'),
        expect.arrayContaining([`usageStats-${yesterday}`, `usageStats-${twoDaysAgo}`])
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[DailyReset] Current day (${today}) has 1 site(s) with usage data - preserved`)
      );
      expect(consoleSpy).toHaveBeenCalledWith('[DailyReset] Daily reset completed successfully');
    });

    it('should handle case with no old usage statistics', async () => {
      // Only current day data
      mockStorageData = {
        [`usageStats-${today}`]: { site1: { timeSpentSeconds: 100, opens: 2 } },
        'otherData': { someKey: 'someValue' },
      };

      const currentDayStats = { site1: { timeSpentSeconds: 100, opens: 2 } };
      getUsageStats.mockResolvedValueOnce(currentDayStats);

      await performDailyReset();

      // Should not call remove since there are no old stats
      expect(mockStorageArea.remove).not.toHaveBeenCalled();
      
      expect(consoleSpy).toHaveBeenCalledWith('[DailyReset] No old usage statistics found to remove');
    });

    it('should handle case with no usage statistics at all', async () => {
      // No usage data
      mockStorageData = {
        'otherData': { someKey: 'someValue' },
      };

      getUsageStats.mockResolvedValueOnce({});

      await performDailyReset();

      expect(mockStorageArea.remove).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('[DailyReset] No old usage statistics found to remove');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[DailyReset] Current day (${today}) has 0 site(s) with usage data - preserved`)
      );
    });

    it('should handle storage get error gracefully', async () => {
      const error = new Error('Storage access failed');
      mockStorageArea.get.mockRejectedValueOnce(error);

      await expect(performDailyReset()).rejects.toThrow('Storage access failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[DailyReset] Error during daily reset:', error);
    });

    it('should handle storage remove error gracefully', async () => {
      mockStorageData = {
        [`usageStats-${yesterday}`]: { site2: { timeSpentSeconds: 200, opens: 3 } },
      };

      const error = new Error('Storage remove failed');
      mockStorageArea.remove.mockRejectedValueOnce(error);

      await expect(performDailyReset()).rejects.toThrow('Storage remove failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[DailyReset] Error during daily reset:', error);
    });

    it('should handle getUsageStats error gracefully', async () => {
      mockStorageData = {
        [`usageStats-${yesterday}`]: { site2: { timeSpentSeconds: 200, opens: 3 } },
      };

      // First get() call for all storage succeeds, but getUsageStats fails
      const error = new Error('Usage stats access failed');
      getUsageStats.mockRejectedValueOnce(error);

      await expect(performDailyReset()).rejects.toThrow('Usage stats access failed');
    });
  });
}); 