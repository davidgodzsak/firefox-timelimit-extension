import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * @file usage_storage.test.js
 * @description Unit tests for usage_storage.js.
 */

const mockStorageArea = {
  get: jest.fn(),
  set: jest.fn(),
};
global.browser = {
  storage: {
    local: mockStorageArea,
  },
};

import {
  getUsageStats,
  updateUsageStats,
} from '../../../background_scripts/usage_storage.js';

describe('usage_storage.js', () => {
  let mockLocalStorageData;
  let consoleErrorSpy;

  beforeEach(() => {
    mockLocalStorageData = {};

    mockStorageArea.get.mockImplementation(async (key) => {
        const result = {};
        if (mockLocalStorageData.hasOwnProperty(key)) {
          result[key] = mockLocalStorageData[key];
        }
        return Promise.resolve(result);
      });
  
      mockStorageArea.set.mockImplementation(async (items) => {
        Object.assign(mockLocalStorageData, items);
        return Promise.resolve();
      });

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockStorageArea.get.mockClear();
    mockStorageArea.set.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('getUsageStats', () => {
    it('should return an empty object if no stats for the date', async () => {
      const stats = await getUsageStats('2023-01-01');
      expect(stats).toEqual({});
    });

    it('should return stored usage stats for the date', async () => {
      const storedStats = { site1: { timeSpentSeconds: 100, opens: 5 } };
      mockLocalStorageData['usageStats-2023-01-01'] = storedStats;
      const stats = await getUsageStats('2023-01-01');
      expect(stats).toEqual(storedStats);
    });

    it('should return an empty object on storage error and log error', async () => {
      mockStorageArea.get.mockRejectedValueOnce(new Error('Storage failed'));
      const stats = await getUsageStats('2023-01-01');
      expect(stats).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error getting usage stats for date 2023-01-01:", expect.any(Error));
    });
  });

  describe('updateUsageStats', () => {
    const dateString = '2023-01-01';
    const siteId = 'site-abc';
    const storageKey = `usageStats-${dateString}`;

    it('should create new usage entry if none exists for date', async () => {
      const usageData = { timeSpentSeconds: 100, opens: 1 };
      const result = await updateUsageStats(dateString, siteId, usageData);
      expect(result).toBe(true);
      expect(mockLocalStorageData[storageKey][siteId]).toEqual(usageData);
    });

    it('should update existing entry', async () => {
        mockLocalStorageData[storageKey] = {
            [siteId]: { timeSpentSeconds: 50, opens: 2 },
        };
        const usageData = { timeSpentSeconds: 150, opens: 3 };
        const result = await updateUsageStats(dateString, siteId, usageData);
        expect(result).toBe(true);
        expect(mockLocalStorageData[storageKey][siteId]).toEqual(usageData);
    });

    it('should return false on storage set error and log error', async () => {
      mockStorageArea.set.mockRejectedValueOnce(new Error('Set failed'));
      const usageData = { timeSpentSeconds: 10, opens: 1 };
      const result = await updateUsageStats(dateString, siteId, usageData);
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(`Error updating usage stats for site ${siteId} on date ${dateString}:`, expect.any(Error));
    });
  });
}); 