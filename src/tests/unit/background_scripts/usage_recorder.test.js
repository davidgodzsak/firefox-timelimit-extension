/**
 * @file usage_recorder.test.js
 * @description Unit tests for the usage recorder module (event-driven, stateless version).
 */

import { jest } from '@jest/globals';

// Mock the usage_storage module
jest.unstable_mockModule('../../../background_scripts/usage_storage.js', () => ({
  getUsageStats: jest.fn(),
  updateUsageStats: jest.fn(),
}));

// Mock browser.storage.session
const mockSessionStorage = {
  data: {},
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
};

global.browser = {
  storage: {
    session: mockSessionStorage,
  },
};

// Import the mocked functions
const { getUsageStats, updateUsageStats } = await import('../../../background_scripts/usage_storage.js');

// Import the module under test after mocking its dependencies
const { 
  startTracking, 
  stopTracking, 
  updateUsage, 
  getCurrentTrackingInfo, 
  recordSiteOpen 
} = await import('../../../background_scripts/usage_recorder.js');

describe('UsageRecorder (Event-Driven)', () => {
  let currentTime;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockSessionStorage.data = {};
    
    // Set up time mocking
    currentTime = 1620000000000; // Fixed timestamp for tests
    global.Date.now = jest.fn(() => currentTime);

    // Default mock implementations
    getUsageStats.mockResolvedValue({});
    updateUsageStats.mockResolvedValue(true);

    // Set up session storage mocks
    mockSessionStorage.get.mockImplementation((keys) => {
      const result = {};
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => {
        if (mockSessionStorage.data[key] !== undefined) {
          result[key] = mockSessionStorage.data[key];
        }
      });
      return Promise.resolve(result);
    });

    mockSessionStorage.set.mockImplementation((data) => {
      Object.assign(mockSessionStorage.data, data);
      return Promise.resolve();
    });

    mockSessionStorage.remove.mockImplementation((keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => {
        delete mockSessionStorage.data[key];
      });
      return Promise.resolve();
    });

    mockSessionStorage.clear.mockImplementation(() => {
      mockSessionStorage.data = {};
      return Promise.resolve();
    });
  });

  describe('startTracking', () => {
    it('should start tracking for a new site and tab', async () => {
      const result = await startTracking(123, 'site1');
      
      expect(result).toBe(true);
      expect(mockSessionStorage.set).toHaveBeenCalledWith({
        tracking_siteId: 'site1',
        tracking_startTime: currentTime,
        tracking_tabId: 123,
        tracking_isActive: true,
      });
      
      // Should record the site open event
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 0,
          opens: 1,
        })
      );
    });

    it('should stop previous tracking before starting new tracking', async () => {
      // Set up existing tracking state
      mockSessionStorage.data = {
        tracking_siteId: 'oldSite',
        tracking_startTime: currentTime - 5000,
        tracking_tabId: 456,
        tracking_isActive: true,
      };

      // Start new tracking
      currentTime += 1000; // Advance time
      const result = await startTracking(789, 'newSite');

      expect(result).toBe(true);
      
      // Should have recorded time for the old site
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'oldSite',
        expect.objectContaining({
          timeSpentSeconds: 6, // 5000ms + 1000ms = 6 seconds
          opens: 0,
        })
      );
      
      // Should have started tracking the new site
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'newSite',
        expect.objectContaining({
          timeSpentSeconds: 0,
          opens: 1,
        })
      );
    });

    it('should handle invalid parameters', async () => {
      const result1 = await startTracking(null, 'site1');
      const result2 = await startTracking(123, null);
      const result3 = await startTracking(null, null);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
      expect(mockSessionStorage.set).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      mockSessionStorage.set.mockRejectedValue(new Error('Storage error'));

      const result = await startTracking(123, 'site1');

      expect(result).toBe(false);
    });
  });

  describe('stopTracking', () => {
    it('should stop active tracking and record final time', async () => {
      // Set up active tracking
      mockSessionStorage.data = {
        tracking_siteId: 'site1',
        tracking_startTime: currentTime - 3000,
        tracking_tabId: 123,
        tracking_isActive: true,
      };

      const totalTime = await stopTracking();

      expect(totalTime).toBeGreaterThan(0);
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 3,
          opens: 0,
        })
      );
      expect(mockSessionStorage.remove).toHaveBeenCalled();
    });

    it('should handle no active tracking gracefully', async () => {
      const totalTime = await stopTracking();

      expect(totalTime).toBe(0);
      expect(updateUsageStats).not.toHaveBeenCalled();
      expect(mockSessionStorage.remove).toHaveBeenCalled(); // Should still clear state
    });

    it('should handle incomplete tracking state', async () => {
      // Set up incomplete tracking state
      mockSessionStorage.data = {
        tracking_siteId: 'site1',
        tracking_isActive: true,
        // Missing startTime
      };

      const totalTime = await stopTracking();

      expect(totalTime).toBe(0);
      expect(updateUsageStats).not.toHaveBeenCalled();
      expect(mockSessionStorage.remove).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      mockSessionStorage.data = {
        tracking_siteId: 'site1',
        tracking_startTime: currentTime - 1000,
        tracking_tabId: 123,
        tracking_isActive: true,
      };
      
      mockSessionStorage.get.mockRejectedValue(new Error('Storage error'));

      const totalTime = await stopTracking();

      expect(totalTime).toBe(0);
      expect(mockSessionStorage.remove).toHaveBeenCalled();
    });
  });

  describe('updateUsage', () => {
    it('should update usage for active tracking and reset start time', async () => {
      // Set up active tracking
      const startTime = currentTime - 2000;
      mockSessionStorage.data = {
        tracking_siteId: 'site1',
        tracking_startTime: startTime,
        tracking_tabId: 123,
        tracking_isActive: true,
      };

      const totalTime = await updateUsage();

      expect(totalTime).toBeGreaterThan(0);
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 2,
          opens: 0,
        })
      );
      
      // Should reset start time
      expect(mockSessionStorage.set).toHaveBeenCalledWith({
        tracking_startTime: currentTime,
      });
    });

    it('should handle no active tracking', async () => {
      const totalTime = await updateUsage();

      expect(totalTime).toBe(0);
      expect(updateUsageStats).not.toHaveBeenCalled();
      expect(mockSessionStorage.set).not.toHaveBeenCalled();
    });

    it('should handle zero elapsed time', async () => {
      // Set up tracking with current time as start time (no elapsed time)
      mockSessionStorage.data = {
        tracking_siteId: 'site1',
        tracking_startTime: currentTime,
        tracking_tabId: 123,
        tracking_isActive: true,
      };

      const totalTime = await updateUsage();

      expect(totalTime).toBe(0);
      expect(updateUsageStats).not.toHaveBeenCalled();
      expect(mockSessionStorage.set).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentTrackingInfo', () => {
    it('should return current tracking information', async () => {
      mockSessionStorage.data = {
        tracking_siteId: 'site1',
        tracking_startTime: currentTime,
        tracking_tabId: 123,
        tracking_isActive: true,
      };

      const info = await getCurrentTrackingInfo();

      expect(info).toEqual({
        isTracking: true,
        siteId: 'site1',
        tabId: 123,
        startTime: currentTime,
      });
    });

    it('should return default values when no tracking is active', async () => {
      const info = await getCurrentTrackingInfo();

      expect(info).toEqual({
        isTracking: false,
        siteId: null,
        tabId: null,
        startTime: null,
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockSessionStorage.get.mockRejectedValue(new Error('Storage error'));

      const info = await getCurrentTrackingInfo();

      expect(info).toEqual({
        isTracking: false,
        siteId: null,
        tabId: null,
        startTime: null,
      });
    });
  });

  describe('recordSiteOpen', () => {
    it('should record a site open event', async () => {
      const result = await recordSiteOpen('site1');

      expect(result).toBe(true);
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 0,
          opens: 1,
        })
      );
    });

    it('should handle invalid site ID', async () => {
      const result1 = await recordSiteOpen(null);
      const result2 = await recordSiteOpen('');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(updateUsageStats).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      updateUsageStats.mockRejectedValue(new Error('Storage error'));

      const result = await recordSiteOpen('site1');

      expect(result).toBe(false);
    });
  });

  describe('date handling', () => {
    it('should use current date for storage keys', async () => {
      // Mock current date to 2023-06-15
      const mockDate = new Date('2023-06-15T10:30:00Z');
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            return mockDate;
          }
          return new (Function.prototype.bind.apply(Date, [null, ...args]));
        }
        static now() {
          return mockDate.getTime();
        }
        getFullYear() { return mockDate.getFullYear(); }
        getMonth() { return mockDate.getMonth(); }
        getDate() { return mockDate.getDate(); }
      };

      await recordSiteOpen('site1');

      expect(updateUsageStats).toHaveBeenCalledWith(
        '2023-06-15',
        'site1',
        expect.any(Object)
      );
    });
  });
}); 