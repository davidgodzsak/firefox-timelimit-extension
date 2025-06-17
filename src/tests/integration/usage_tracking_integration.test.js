/**
 * @file usage_tracking_integration.test.js
 * @description Integration tests for the event-driven usage tracking system.
 * Tests the interaction between background.js event handlers and usage_recorder.js.
 */

import { jest } from '@jest/globals';

// Mock the required modules
jest.unstable_mockModule('../../background_scripts/usage_storage.js', () => ({
  getUsageStats: jest.fn(),
  updateUsageStats: jest.fn(),
}));

jest.unstable_mockModule('../../background_scripts/site_storage.js', () => ({
  getDistractingSites: jest.fn(),
}));

jest.unstable_mockModule('../../background_scripts/badge_manager.js', () => ({
  updateBadge: jest.fn(),
}));

// Mock browser APIs
const mockBrowser = {
  storage: {
    session: {
      data: {},
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
  },
  tabs: {
    get: jest.fn(),
    query: jest.fn(),
  },
  windows: {
    getCurrent: jest.fn(),
    WINDOW_ID_NONE: -1,
  },
};

global.browser = mockBrowser;

// Import the modules after setting up mocks
const { getUsageStats, updateUsageStats } = await import('../../background_scripts/usage_storage.js');
const { getDistractingSites } = await import('../../background_scripts/site_storage.js');
const { updateBadge } = await import('../../background_scripts/badge_manager.js');

// Import usage recorder functions
const {
  startTracking,
  stopTracking,
  updateUsage,
  getCurrentTrackingInfo,
} = await import('../../background_scripts/usage_recorder.js');

// Import distraction detector functions
const {
  checkIfUrlIsDistracting,
  initializeDistractionDetector,
} = await import('../../background_scripts/distraction_detector.js');

describe('Usage Tracking Integration', () => {
  let currentTime;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    mockBrowser.storage.session.data = {};

    // Set up time mocking
    currentTime = 1620000000000;
    global.Date.now = jest.fn(() => currentTime);

    // Set up session storage mocks
    mockBrowser.storage.session.get.mockImplementation((keys) => {
      const result = {};
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => {
        if (mockBrowser.storage.session.data[key] !== undefined) {
          result[key] = mockBrowser.storage.session.data[key];
        }
      });
      return Promise.resolve(result);
    });

    mockBrowser.storage.session.set.mockImplementation((data) => {
      Object.assign(mockBrowser.storage.session.data, data);
      return Promise.resolve();
    });

    mockBrowser.storage.session.remove.mockImplementation((keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => {
        delete mockBrowser.storage.session.data[key];
      });
      return Promise.resolve();
    });

    // Default mock implementations
    getUsageStats.mockResolvedValue({});
    updateUsageStats.mockResolvedValue(true);
    updateBadge.mockResolvedValue();
    
    // Mock distracting sites
    getDistractingSites.mockResolvedValue([
      {
        id: 'site1',
        urlPattern: 'youtube.com',
        dailyLimitSeconds: 1800,
        isEnabled: true,
      },
      {
        id: 'site2',
        urlPattern: 'reddit.com',
        dailyLimitSeconds: 3600,
        isEnabled: true,
      },
    ]);

    // Initialize distraction detector with mocked sites
    await initializeDistractionDetector();
  });

  describe('Tab Activity Simulation', () => {
    it('should start tracking when navigating to a distracting site', async () => {
      const tabId = 123;
      const url = 'https://www.youtube.com/watch?v=test';

      // Check if site is distracting
      const distractionCheck = checkIfUrlIsDistracting(url);
      expect(distractionCheck.isMatch).toBe(true);
      expect(distractionCheck.siteId).toBe('site1');

      // Simulate starting tracking
      const success = await startTracking(tabId, distractionCheck.siteId);
      expect(success).toBe(true);

      // Verify tracking state
      const trackingInfo = await getCurrentTrackingInfo();
      expect(trackingInfo.isTracking).toBe(true);
      expect(trackingInfo.siteId).toBe('site1');
      expect(trackingInfo.tabId).toBe(tabId);

      // Verify site open was recorded
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 0,
          opens: 1,
        })
      );
    });

    it('should stop tracking when navigating away from distracting site', async () => {
      // Start tracking first
      await startTracking(123, 'site1');
      
      // Advance time
      currentTime += 5000;

      // Stop tracking
      const totalTime = await stopTracking();

      expect(totalTime).toBeGreaterThan(0);
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 5,
          opens: 0,
        })
      );

      // Verify tracking state is cleared
      const trackingInfo = await getCurrentTrackingInfo();
      expect(trackingInfo.isTracking).toBe(false);
    });

    it('should switch tracking between different distracting sites', async () => {
      // Start tracking site1
      await startTracking(123, 'site1');
      currentTime += 3000;

      // Switch to site2
      await startTracking(456, 'site2');

      // Verify site1 time was recorded
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 3,
          opens: 0,
        })
      );

      // Verify site2 tracking started
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site2',
        expect.objectContaining({
          timeSpentSeconds: 0,
          opens: 1,
        })
      );

      const trackingInfo = await getCurrentTrackingInfo();
      expect(trackingInfo.siteId).toBe('site2');
      expect(trackingInfo.tabId).toBe(456);
    });
  });

  describe('Alarm-Based Updates', () => {
    it('should update usage when alarm fires', async () => {
      // Start tracking
      await startTracking(123, 'site1');
      
      // Advance time to simulate alarm interval
      currentTime += 60000; // 1 minute

      // Simulate alarm firing
      const totalTime = await updateUsage();

      expect(totalTime).toBeGreaterThan(0);
      expect(updateUsageStats).toHaveBeenCalledWith(
        expect.any(String),
        'site1',
        expect.objectContaining({
          timeSpentSeconds: 60,
          opens: 0,
        })
      );

      // Verify tracking continues (start time reset)
      const trackingInfo = await getCurrentTrackingInfo();
      expect(trackingInfo.isTracking).toBe(true);
      expect(trackingInfo.startTime).toBe(currentTime);
    });

    it('should handle multiple alarm updates during a session', async () => {
      // Start tracking
      await startTracking(123, 'site1');

      // Simulate multiple alarm fires
      for (let i = 1; i <= 3; i++) {
        currentTime += 60000; // Advance 1 minute
        await updateUsage();
      }

      // Should have 3 usage updates plus initial site open
      expect(updateUsageStats).toHaveBeenCalledTimes(4);
      
      // Each update should be for 60 seconds
      const calls = updateUsageStats.mock.calls.slice(1); // Skip the initial open call
      calls.forEach(call => {
        expect(call[2]).toEqual(expect.objectContaining({
          timeSpentSeconds: 60,
          opens: 0,
        }));
      });
    });
  });

  describe('URL Pattern Matching', () => {
    it('should detect various YouTube URLs as distracting', async () => {
      const youtubeUrls = [
        'https://www.youtube.com/',
        'https://youtube.com/watch?v=test',
        'https://m.youtube.com/watch?v=test',
        'https://music.youtube.com/',
      ];

      youtubeUrls.forEach(url => {
        const result = checkIfUrlIsDistracting(url);
        expect(result.isMatch).toBe(true);
        expect(result.siteId).toBe('site1');
      });
    });

    it('should not detect non-distracting sites', async () => {
      const nonDistractingUrls = [
        'https://www.google.com/',
        'https://github.com/',
        'https://stackoverflow.com/',
        'chrome://newtab/',
      ];

      nonDistractingUrls.forEach(url => {
        const result = checkIfUrlIsDistracting(url);
        expect(result.isMatch).toBe(false);
        expect(result.siteId).toBeNull();
      });
    });
  });

  describe('Badge Integration', () => {
    it('should integrate with badge manager during tracking', async () => {
      // Mock dynamic import for badge manager
      const mockBadgeModule = { updateBadge: jest.fn().mockResolvedValue() };
      
      // This simulates the dynamic import in background.js
      const originalImport = global.import;
      global.import = jest.fn().mockResolvedValue(mockBadgeModule);

      try {
        // Start tracking
        await startTracking(123, 'site1');

        // Simulate alarm update
        currentTime += 60000;
        await updateUsage();

        // In real usage, background.js would handle badge updates
        // We can verify the tracking state is available for badge updates
        const trackingInfo = await getCurrentTrackingInfo();
        expect(trackingInfo.isTracking).toBe(true);
        expect(trackingInfo.tabId).toBe(123);
      } finally {
        global.import = originalImport;
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock storage error
      mockBrowser.storage.session.set.mockRejectedValue(new Error('Storage error'));

      const success = await startTracking(123, 'site1');
      expect(success).toBe(false);

      // Should not crash and tracking should remain inactive
      const trackingInfo = await getCurrentTrackingInfo();
      expect(trackingInfo.isTracking).toBe(false);
    });

    it('should handle usage update errors gracefully', async () => {
      // Start tracking successfully
      await startTracking(123, 'site1');

      // Mock error during usage update
      updateUsageStats.mockRejectedValue(new Error('Usage update error'));

      currentTime += 60000;
      const totalTime = await updateUsage();

      // Should return 0 but not crash
      expect(totalTime).toBe(0);
    });

    it('should recover from invalid tracking state', async () => {
      // Set up invalid tracking state directly
      mockBrowser.storage.session.data = {
        tracking_siteId: 'site1',
        tracking_isActive: true,
        // Missing required fields like startTime
      };

      // Should handle gracefully
      const trackingInfo = await getCurrentTrackingInfo();
      expect(trackingInfo.isTracking).toBe(true);
      expect(trackingInfo.startTime).toBeNull();

      // Update should handle missing startTime
      const totalTime = await updateUsage();
      expect(totalTime).toBe(0);
    });
  });

  describe('Session Persistence', () => {
    it('should maintain tracking state across function calls', async () => {
      // Start tracking
      await startTracking(123, 'site1');

      // Get tracking info from different function
      const trackingInfo = await getCurrentTrackingInfo();
      expect(trackingInfo.isTracking).toBe(true);
      expect(trackingInfo.siteId).toBe('site1');
      expect(trackingInfo.tabId).toBe(123);

      // Update usage
      currentTime += 30000;
      await updateUsage();

      // Verify tracking continues
      const updatedInfo = await getCurrentTrackingInfo();
      expect(updatedInfo.isTracking).toBe(true);
      expect(updatedInfo.siteId).toBe('site1');
    });
  });
}); 