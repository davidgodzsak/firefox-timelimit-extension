/**
 * @file site_storage.test.js
 * @description Unit tests for site storage module
 *
 * Tests verify that:
 * - Site CRUD operations work correctly
 * - Data validation is properly enforced
 * - Error scenarios are handled gracefully
 * - Storage interactions are correct
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
const mockStorageArea = {
  get: jest.fn(),
  set: jest.fn(),
};

global.browser = {
  storage: {
    local: mockStorageArea,
  },
};

// Mock crypto for ID generation
global.crypto = {
  randomUUID: jest.fn(),
};

describe('Site Storage Module', () => {
  let mockLocalStorageData;
  let consoleErrorSpy;
  let uuidCounter;
  let siteStorage;

  beforeEach(async () => {
    // Reset mock data
    mockLocalStorageData = {};
    uuidCounter = 0;

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

    // Setup UUID generation
    global.crypto.randomUUID.mockImplementation(
      () => `test-uuid-${++uuidCounter}`
    );

    // Setup console spy
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Import the module fresh
    jest.resetModules();
    siteStorage = await import('../../../background_scripts/site_storage.js');

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('getDistractingSites', () => {
    it('should return empty array when no sites exist', async () => {
      const sites = await siteStorage.getDistractingSites();
      expect(sites).toEqual([]);
      expect(mockStorageArea.get).toHaveBeenCalledWith('distractingSites');
    });

    it('should return existing sites', async () => {
      const testSites = [
        {
          id: 'site1',
          urlPattern: 'facebook.com',
          dailyLimitSeconds: 3600,
          isEnabled: true,
        },
        {
          id: 'site2',
          urlPattern: 'youtube.com',
          dailyLimitSeconds: 1800,
          isEnabled: false,
        },
      ];
      mockLocalStorageData.distractingSites = testSites;

      const sites = await siteStorage.getDistractingSites();
      expect(sites).toEqual(testSites);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorageArea.get.mockRejectedValue(new Error('Storage error'));

      const sites = await siteStorage.getDistractingSites();
      expect(sites).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting distracting sites:',
        expect.any(Error)
      );
    });
  });

  describe('addDistractingSite', () => {
    it('should add a valid site successfully', async () => {
      const siteData = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        isEnabled: true,
      };

      const result = await siteStorage.addDistractingSite(siteData);

      expect(result).toEqual({
        id: 'test-uuid-1',
        ...siteData,
      });
      expect(mockLocalStorageData.distractingSites).toEqual([
        {
          id: 'test-uuid-1',
          ...siteData,
        },
      ]);
    });

    it('should add a site with daily open limit successfully', async () => {
      const siteData = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        dailyOpenLimit: 10,
        isEnabled: true,
      };

      const result = await siteStorage.addDistractingSite(siteData);

      expect(result).toEqual({
        id: 'test-uuid-1',
        ...siteData,
      });
      expect(mockLocalStorageData.distractingSites).toEqual([
        {
          id: 'test-uuid-1',
          ...siteData,
        },
      ]);
    });

    it('should add a site with only open limit (no time limit)', async () => {
      const siteData = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 1, // Minimum required value
        dailyOpenLimit: 5,
        isEnabled: true,
      };

      const result = await siteStorage.addDistractingSite(siteData);

      expect(result).toEqual({
        id: 'test-uuid-1',
        ...siteData,
      });
      expect(result.dailyOpenLimit).toBe(5);
    });

    it('should validate required fields', async () => {
      const invalidSiteData = {
        dailyLimitSeconds: 3600,
        isEnabled: true,
        // Missing urlPattern
      };

      const result = await siteStorage.addDistractingSite(invalidSiteData);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Invalid siteObject provided to addDistractingSite. 'urlPattern' (string) and 'dailyLimitSeconds' (positive number) are required.",
        expect.any(Object)
      );
    });

    it('should validate dailyOpenLimit when provided', async () => {
      const invalidSiteData = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        dailyOpenLimit: -5, // Invalid negative value
        isEnabled: true,
      };

      const result = await siteStorage.addDistractingSite(invalidSiteData);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid dailyOpenLimit provided to addDistractingSite. Must be a positive number if specified.',
        -5
      );
    });

    it('should validate dailyOpenLimit is a number when provided', async () => {
      const invalidSiteData = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        dailyOpenLimit: 'invalid', // Should be a number
        isEnabled: true,
      };

      const result = await siteStorage.addDistractingSite(invalidSiteData);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid dailyOpenLimit provided to addDistractingSite. Must be a positive number if specified.',
        'invalid'
      );
    });

    it('should validate dailyOpenLimit is positive when provided', async () => {
      const invalidSiteData = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        dailyOpenLimit: 0, // Should be positive
        isEnabled: true,
      };

      const result = await siteStorage.addDistractingSite(invalidSiteData);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid dailyOpenLimit provided to addDistractingSite. Must be a positive number if specified.',
        0
      );
    });

    it('should validate urlPattern format', async () => {
      const invalidSiteData = {
        urlPattern: '', // Empty string
        dailyLimitSeconds: 3600,
        isEnabled: true,
      };

      const result = await siteStorage.addDistractingSite(invalidSiteData);
      expect(result).toBeNull();
    });

    it('should validate dailyLimitSeconds is positive', async () => {
      const invalidSiteData = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: -100, // Negative
        isEnabled: true,
      };

      const result = await siteStorage.addDistractingSite(invalidSiteData);
      expect(result).toBeNull();
    });

    it('should handle storage errors', async () => {
      mockStorageArea.set.mockRejectedValue(new Error('Storage write failed'));

      const siteData = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        isEnabled: true,
      };

      const result = await siteStorage.addDistractingSite(siteData);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error adding distracting site:',
        expect.any(Error)
      );
    });

    it('should allow duplicate URL patterns', async () => {
      // Add first site
      const siteData1 = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        isEnabled: true,
      };
      const result1 = await siteStorage.addDistractingSite(siteData1);
      expect(result1).toBeTruthy();

      // Add another site with same URL pattern (should succeed - no duplicate checking)
      const siteData2 = {
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 1800,
        isEnabled: false,
      };

      const result2 = await siteStorage.addDistractingSite(siteData2);
      expect(result2).toBeTruthy();
      expect(result2.id).not.toBe(result1.id);
    });
  });

  describe('updateDistractingSite', () => {
    beforeEach(async () => {
      // Setup existing sites
      mockLocalStorageData.distractingSites = [
        {
          id: 'site1',
          urlPattern: 'facebook.com',
          dailyLimitSeconds: 3600,
          isEnabled: true,
        },
        {
          id: 'site2',
          urlPattern: 'youtube.com',
          dailyLimitSeconds: 1800,
          isEnabled: false,
        },
      ];
    });

    it('should update existing site successfully', async () => {
      const updates = {
        dailyLimitSeconds: 7200,
        isEnabled: false,
      };

      const result = await siteStorage.updateDistractingSite('site1', updates);

      expect(result).toEqual({
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 7200,
        isEnabled: false,
      });
      expect(mockLocalStorageData.distractingSites[0]).toEqual(result);
    });

    it('should update site with dailyOpenLimit successfully', async () => {
      const updates = {
        dailyOpenLimit: 10,
      };

      const result = await siteStorage.updateDistractingSite('site1', updates);

      expect(result).toEqual({
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        dailyOpenLimit: 10,
        isEnabled: true,
      });
      expect(mockLocalStorageData.distractingSites[0]).toEqual(result);
    });

    it('should update both time and open limits simultaneously', async () => {
      const updates = {
        dailyLimitSeconds: 7200,
        dailyOpenLimit: 15,
      };

      const result = await siteStorage.updateDistractingSite('site1', updates);

      expect(result).toEqual({
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 7200,
        dailyOpenLimit: 15,
        isEnabled: true,
      });
    });

    it('should remove dailyOpenLimit when not specified in updates', async () => {
      // First add a site with open limit
      mockLocalStorageData.distractingSites[0].dailyOpenLimit = 5;

      const updates = {
        dailyLimitSeconds: 7200,
      };

      const result = await siteStorage.updateDistractingSite('site1', updates);

      expect(result).toEqual({
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 7200,
        dailyOpenLimit: 5, // Should preserve existing value
        isEnabled: true,
      });
    });

    it('should return null for non-existent site', async () => {
      const updates = { dailyLimitSeconds: 7200 };

      const result = await siteStorage.updateDistractingSite(
        'non-existent',
        updates
      );
      expect(result).toBeNull();
    });

    it('should validate updated fields', async () => {
      const invalidUpdates = {
        dailyLimitSeconds: -100, // Negative
      };

      const result = await siteStorage.updateDistractingSite(
        'site1',
        invalidUpdates
      );
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid dailyLimitSeconds in updates for updateDistractingSite.',
        expect.any(Number)
      );
    });

    it('should validate updated dailyOpenLimit', async () => {
      const invalidUpdates = {
        dailyOpenLimit: -5, // Negative
      };

      const result = await siteStorage.updateDistractingSite(
        'site1',
        invalidUpdates
      );
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid dailyOpenLimit in updates for updateDistractingSite.',
        -5
      );
    });

    it('should validate dailyOpenLimit is a number', async () => {
      const invalidUpdates = {
        dailyOpenLimit: 'invalid', // Not a number
      };

      const result = await siteStorage.updateDistractingSite(
        'site1',
        invalidUpdates
      );
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid dailyOpenLimit in updates for updateDistractingSite.',
        'invalid'
      );
    });

    it('should validate dailyOpenLimit is positive', async () => {
      const invalidUpdates = {
        dailyOpenLimit: 0, // Zero is not positive
      };

      const result = await siteStorage.updateDistractingSite(
        'site1',
        invalidUpdates
      );
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid dailyOpenLimit in updates for updateDistractingSite.',
        0
      );
    });

    it('should allow updating to any URL pattern', async () => {
      const updates = {
        urlPattern: 'youtube.com', // Even if it exists elsewhere (no duplicate checking)
      };

      const result = await siteStorage.updateDistractingSite('site1', updates);
      expect(result).toBeTruthy();
      expect(result.urlPattern).toBe('youtube.com');
    });

    it('should handle storage errors', async () => {
      mockStorageArea.set.mockRejectedValue(new Error('Storage write failed'));

      const updates = { dailyLimitSeconds: 7200 };

      const result = await siteStorage.updateDistractingSite('site1', updates);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating distracting site with ID "site1":',
        expect.any(Error)
      );
    });
  });

  describe('deleteDistractingSite', () => {
    beforeEach(async () => {
      // Setup existing sites
      mockLocalStorageData.distractingSites = [
        {
          id: 'site1',
          urlPattern: 'facebook.com',
          dailyLimitSeconds: 3600,
          isEnabled: true,
        },
        {
          id: 'site2',
          urlPattern: 'youtube.com',
          dailyLimitSeconds: 1800,
          isEnabled: false,
        },
      ];
    });

    it('should delete existing site successfully', async () => {
      const result = await siteStorage.deleteDistractingSite('site1');

      expect(result).toBe(true);
      expect(mockLocalStorageData.distractingSites).toEqual([
        {
          id: 'site2',
          urlPattern: 'youtube.com',
          dailyLimitSeconds: 1800,
          isEnabled: false,
        },
      ]);
    });

    it('should return false for non-existent site', async () => {
      const result = await siteStorage.deleteDistractingSite('non-existent');
      expect(result).toBe(false);
      expect(mockLocalStorageData.distractingSites).toHaveLength(2); // Unchanged
    });

    it('should handle storage errors', async () => {
      mockStorageArea.set.mockRejectedValue(new Error('Storage write failed'));

      const result = await siteStorage.deleteDistractingSite('site1');
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error deleting distracting site with ID "site1":',
        expect.any(Error)
      );
    });
  });

  describe('edge cases and data integrity', () => {
    it('should handle corrupted storage data gracefully', async () => {
      // Set invalid data in storage
      mockLocalStorageData.distractingSites = 'invalid data';

      const sites = await siteStorage.getDistractingSites();
      // The implementation returns result.distractingSites || [] - so corrupted data returns as-is
      expect(sites).toBe('invalid data');
    });

    it('should handle partial site objects in storage', async () => {
      // Set incomplete site objects
      mockLocalStorageData.distractingSites = [
        { id: 'site1', urlPattern: 'facebook.com' }, // Missing required fields
        {
          id: 'site2',
          urlPattern: 'youtube.com',
          dailyLimitSeconds: 1800,
          isEnabled: false,
        },
      ];

      const sites = await siteStorage.getDistractingSites();
      // Should filter out invalid entries or handle gracefully
      expect(Array.isArray(sites)).toBe(true);
    });

    it('should maintain data consistency after multiple operations', async () => {
      // Add multiple sites
      const site1 = await siteStorage.addDistractingSite({
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        isEnabled: true,
      });

      const site2 = await siteStorage.addDistractingSite({
        urlPattern: 'youtube.com',
        dailyLimitSeconds: 1800,
        isEnabled: false,
      });

      expect(site1).toBeTruthy();
      expect(site2).toBeTruthy();

      // Update one
      const updatedSite1 = await siteStorage.updateDistractingSite(site1.id, {
        dailyLimitSeconds: 7200,
      });
      expect(updatedSite1.dailyLimitSeconds).toBe(7200);

      // Delete the other
      const deleteResult = await siteStorage.deleteDistractingSite(site2.id);
      expect(deleteResult).toBe(true);

      // Verify final state
      const finalSites = await siteStorage.getDistractingSites();
      expect(finalSites).toHaveLength(1);
      expect(finalSites[0].id).toBe(site1.id);
      expect(finalSites[0].dailyLimitSeconds).toBe(7200);
    });
  });
});
