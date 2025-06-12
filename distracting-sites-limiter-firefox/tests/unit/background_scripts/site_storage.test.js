import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * @file site_storage.test.js
 * @description Unit tests for site_storage.js.
 */

// Mock browser APIs before importing the module under test
const mockStorageArea = {
  get: jest.fn(),
  set: jest.fn(),
};
global.browser = {
  storage: {
    local: mockStorageArea,
  },
};

// Mock crypto.randomUUID
const mockCrypto = {
  randomUUID: jest.fn(),
};
global.crypto = mockCrypto;

// Import the functions to be tested
import {
  getDistractingSites,
  addDistractingSite,
  updateDistractingSite,
  deleteDistractingSite
} from '../../../background_scripts/site_storage.js';

describe('site_storage.js', () => {
  let mockLocalStorageData;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    mockLocalStorageData = {};

    mockStorageArea.get.mockImplementation(async (key) => {
      const result = {};
      if (key === 'distractingSites' && mockLocalStorageData.distractingSites) {
        result.distractingSites = mockLocalStorageData.distractingSites;
      }
      return Promise.resolve(result);
    });

    mockStorageArea.set.mockImplementation(async (items) => {
      if (items.hasOwnProperty('distractingSites')) {
        mockLocalStorageData.distractingSites = items.distractingSites;
      }
      return Promise.resolve();
    });

    let uuidCounter = 0;
    mockCrypto.randomUUID.mockImplementation(() => `test-uuid-${++uuidCounter}`);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockStorageArea.get.mockClear();
    mockStorageArea.set.mockClear();
    mockCrypto.randomUUID.mockClear();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('getDistractingSites', () => {
    it('should return an empty array if no sites are stored', async () => {
      const sites = await getDistractingSites();
      expect(sites).toEqual([]);
    });

    it('should return stored distracting sites', async () => {
      const storedSites = [{ id: '1', urlPattern: 'example.com' }];
      mockLocalStorageData.distractingSites = storedSites;
      const sites = await getDistractingSites();
      expect(sites).toEqual(storedSites);
    });

    it('should return an empty array on storage error and log error', async () => {
      mockStorageArea.get.mockRejectedValueOnce(new Error('Storage failed'));
      const sites = await getDistractingSites();
      expect(sites).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error getting distracting sites:", expect.any(Error));
    });
  });

  describe('addDistractingSite', () => {
    it('should add a new site with a generated ID and default isEnabled', async () => {
      const siteObject = { urlPattern: 'news.com', dailyLimitSeconds: 3600 };
      const addedSite = await addDistractingSite(siteObject);
      expect(addedSite).toEqual({
        id: 'test-uuid-1',
        urlPattern: 'news.com',
        dailyLimitSeconds: 3600,
        isEnabled: true,
      });
      expect(mockLocalStorageData.distractingSites).toEqual([addedSite]);
    });

     it('should add a new site with isEnabled set to false', async () => {
        const siteObject = { urlPattern: 'social.com', dailyLimitSeconds: 1800, isEnabled: false };
        const addedSite = await addDistractingSite(siteObject);
        expect(addedSite.isEnabled).toBe(false);
    });

    it('should return null and log error for invalid siteObject', async () => {
      const siteObject = { dailyLimitSeconds: 3600 };
      const result = await addDistractingSite(siteObject);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should trim urlPattern', async () => {
        const siteObject = { urlPattern: '  trimmed.com  ', dailyLimitSeconds: 60 };
        const addedSite = await addDistractingSite(siteObject);
        expect(addedSite.urlPattern).toBe('trimmed.com');
    });

    it('should return null on storage set error and log error', async () => {
      mockStorageArea.set.mockRejectedValueOnce(new Error('Set failed'));
      const siteObject = { urlPattern: 'fail.com', dailyLimitSeconds: 3600 };
      const result = await addDistractingSite(siteObject);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error adding distracting site:", expect.any(Error));
    });
  });

  describe('updateDistractingSite', () => {
    beforeEach(() => {
      mockLocalStorageData.distractingSites = [
        { id: 'test-uuid-1', urlPattern: 'site1.com', dailyLimitSeconds: 100, isEnabled: true },
      ];
    });

    it('should update an existing site', async () => {
      const updates = { dailyLimitSeconds: 150, isEnabled: false };
      const updatedSite = await updateDistractingSite('test-uuid-1', updates);
      expect(updatedSite).toEqual({
        id: 'test-uuid-1',
        urlPattern: 'site1.com',
        dailyLimitSeconds: 150,
        isEnabled: false,
      });
    });

    it('should return null if siteId is not found and log warn', async () => {
      const result = await updateDistractingSite('non-existent-id', { dailyLimitSeconds: 100 });
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Site with ID "non-existent-id" not found for update.');
    });

    it('should return null on storage set error and log error', async () => {
      mockStorageArea.set.mockRejectedValueOnce(new Error('Set failed'));
      const result = await updateDistractingSite('test-uuid-1', { dailyLimitSeconds: 50 });
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating distracting site with ID "test-uuid-1":', expect.any(Error));
    });
  });

  describe('deleteDistractingSite', () => {
    beforeEach(() => {
      mockLocalStorageData.distractingSites = [
        { id: 'test-uuid-1', urlPattern: 'site1.com' },
        { id: 'test-uuid-2', urlPattern: 'site2.com' },
      ];
    });

    it('should delete an existing site and return true', async () => {
      const result = await deleteDistractingSite('test-uuid-1');
      expect(result).toBe(true);
      expect(mockLocalStorageData.distractingSites).toEqual([{ id: 'test-uuid-2', urlPattern: 'site2.com' }]);
    });

    it('should return false if siteId is not found and log warn', async () => {
      const result = await deleteDistractingSite('non-existent-id');
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Site with ID "non-existent-id" not found for deletion.');
    });

    it('should return false on storage set error and log error', async () => {
      mockStorageArea.set.mockRejectedValueOnce(new Error('Set failed'));
      const result = await deleteDistractingSite('test-uuid-1');
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting distracting site with ID "test-uuid-1":', expect.any(Error));
    });
  });
}); 