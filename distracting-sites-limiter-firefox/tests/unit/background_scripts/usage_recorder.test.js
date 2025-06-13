/**
 * @file usage_recorder.test.js
 * @description Unit tests for the usage recorder module.
 */

import { jest } from '@jest/globals';

// Since usage_recorder imports from usage_storage, let's mock those functions globally
// This approach works with the current Jest setup
global.getUsageStats = jest.fn();
global.updateUsageStats = jest.fn();

describe('UsageRecorder', () => {
  let mockIntervalId;
  let mockIntervalCallback;
  let currentTime;

  // Import after globals are set
  let initializeUsageRecorder, startTrackingSiteTime, stopTrackingSiteTime, recordSiteOpen;

  beforeAll(async () => {
    // Now we'll try to patch the usage_recorder module to use our global mocks
    // We need to do this before importing
    const module = await import('../../../background_scripts/usage_recorder.js');
    initializeUsageRecorder = module.initializeUsageRecorder;
    startTrackingSiteTime = module.startTrackingSiteTime;
    stopTrackingSiteTime = module.stopTrackingSiteTime;
    recordSiteOpen = module.recordSiteOpen;
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    global.getUsageStats.mockClear();
    global.updateUsageStats.mockClear();
    jest.useFakeTimers();

    // Set up time mocking
    currentTime = 1620000000000; // Fixed timestamp for tests
    global.Date.now = jest.fn(() => currentTime);

    // Default mock implementations
    global.getUsageStats.mockResolvedValue({});
    global.updateUsageStats.mockResolvedValue(true);

    // Mock setInterval to capture the callback
    mockIntervalId = 123; // Arbitrary ID
    mockIntervalCallback = null;
    global.setInterval = jest.fn((callback, _ms) => {
      mockIntervalCallback = callback;
      return mockIntervalId;
    });

    // Mock clearInterval
    global.clearInterval = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => initializeUsageRecorder()).not.toThrow();
    });
  });

  describe('site time tracking', () => {
    it('should start tracking time for a site', async () => {
      await startTrackingSiteTime('site1');
      
      // Simulate time passing (5 seconds)
      currentTime += 5000;
      if (mockIntervalCallback) {
        await mockIntervalCallback();
      }

      expect(global.updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 5,
          opens: 0,
        })
      );
    });

    it('should stop tracking previous site when starting a new one', async () => {
      await startTrackingSiteTime('site1');
      
      // Simulate time passing (5 seconds)
      currentTime += 5000;
      if (mockIntervalCallback) {
        await mockIntervalCallback();
      }

      await startTrackingSiteTime('site2');
      
      // Simulate time passing (5 seconds)
      currentTime += 5000;
      if (mockIntervalCallback) {
        await mockIntervalCallback();
      }

      expect(global.updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 5,
          opens: 0,
        })
      );
      expect(global.updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site2',
        expect.objectContaining({
          timeSpentSeconds: 5,
          opens: 0,
        })
      );
    });

    it('should stop tracking and record final time slice', async () => {
      await startTrackingSiteTime('site1');
      
      // Simulate time passing (3 seconds)
      currentTime += 3000;
      await stopTrackingSiteTime();

      expect(global.updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 3,
          opens: 0,
        })
      );
    });

    it('should handle multiple tracking intervals', async () => {
      await startTrackingSiteTime('site1');
      
      // Simulate three tracking intervals (5 seconds each)
      for (let i = 0; i < 3; i++) {
        currentTime += 5000;
        if (mockIntervalCallback) {
          await mockIntervalCallback();
        }
      }

      expect(global.updateUsageStats).toHaveBeenCalledTimes(3);
      expect(global.updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 5,
          opens: 0,
        })
      );
    });

    it('should not track time with invalid site ID', async () => {
      await startTrackingSiteTime(null);
      
      // Simulate time passing (5 seconds)
      currentTime += 5000;
      if (mockIntervalCallback) {
        await mockIntervalCallback();
      }

      expect(global.updateUsageStats).not.toHaveBeenCalled();
    });
  });

  describe('site open recording', () => {
    it('should record a site open without time spent', async () => {
      await recordSiteOpen('site1');

      expect(global.updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 0,
          opens: 1,
        })
      );
    });

    it('should not record open with invalid site ID', async () => {
      await recordSiteOpen(null);

      expect(global.updateUsageStats).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      global.updateUsageStats.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(recordSiteOpen('site1')).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle storage read errors gracefully', async () => {
      // Set up storage read error
      global.getUsageStats.mockRejectedValue(new Error('Storage read error'));
      global.updateUsageStats.mockResolvedValue(true); // Make sure updates still work

      await startTrackingSiteTime('site1');
      
      // Simulate time passing (5 seconds)
      currentTime += 5000;
      if (mockIntervalCallback) {
        await mockIntervalCallback();
      }

      // Should still try to update with new stats
      expect(global.updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 5,
          opens: 0,
        })
      );
    });

    it('should handle storage write errors gracefully', async () => {
      global.updateUsageStats.mockRejectedValue(new Error('Storage write error'));

      await startTrackingSiteTime('site1');
      
      // Simulate time passing (5 seconds)
      currentTime += 5000;
      if (mockIntervalCallback) {
        await mockIntervalCallback();
      }

      // Should still try to call updateUsageStats even if it fails
      expect(global.updateUsageStats).toHaveBeenCalled();
    });
  });

  describe('date handling', () => {
    it('should use correct date format for storage', async () => {
      // Mock a specific date - we need to override the Date constructor
      const originalDate = global.Date;
      const mockDate = new Date('2024-03-14T10:30:00Z');
      
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(mockDate);
          } else {
            super(...args);
          }
        }
        
        static now() {
          return mockDate.getTime();
        }
        
        getFullYear() { return mockDate.getFullYear(); }
        getMonth() { return mockDate.getMonth(); }
        getDate() { return mockDate.getDate(); }
      };

      await recordSiteOpen('site1');

      expect(global.updateUsageStats).toHaveBeenCalledWith(
        '2024-03-14',
        'site1',
        expect.any(Object)
      );
      
      // Restore original Date
      global.Date = originalDate;
    });

    it('should handle date changes correctly', async () => {
      global.updateUsageStats.mockResolvedValue(true);

      await startTrackingSiteTime('site1');
      
      // Simulate time passing (5 seconds)
      currentTime += 5000;
      if (mockIntervalCallback) {
        await mockIntervalCallback();
      }

      await stopTrackingSiteTime();

      expect(global.updateUsageStats).toHaveBeenCalled();
    });
  });

  describe('timer management', () => {
    it('should clear interval when stopping tracking', async () => {
      await startTrackingSiteTime('site1');
      await stopTrackingSiteTime();

      expect(global.clearInterval).toHaveBeenCalledWith(mockIntervalId);
    });

    it('should start new interval when starting tracking', async () => {
      await startTrackingSiteTime('site1');

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        5000 // TRACKING_RESOLUTION_MS
      );
    });
  });
}); 