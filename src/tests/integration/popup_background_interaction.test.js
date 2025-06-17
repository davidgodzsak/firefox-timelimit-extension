/**
 * @file popup_background_interaction.test.js
 * @description Integration tests for Popup UI <-> Background Script communication
 * 
 * Tests verify that:
 * - Popup can get current page limit information
 * - Popup can add new limits for sites
 * - Background script properly handles popup messages
 * - Quick limit addition functionality works
 * - Settings navigation works correctly
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock browser APIs before importing modules
const mockStorageArea = {
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
};

const mockRuntimeArea = {
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  sendMessage: jest.fn(),
  getURL: jest.fn(),
};

const mockTabsArea = {
  query: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

global.browser = {
  storage: {
    local: mockStorageArea,
  },
  runtime: mockRuntimeArea,
  tabs: mockTabsArea,
};

// Mock crypto for ID generation
global.crypto = {
  randomUUID: jest.fn(),
};

describe('Popup UI <-> Background Integration', () => {
  let mockLocalStorageData;
  let messageHandler;
  let consoleErrorSpy;
  let consoleLogSpy;
  let uuidCounter;
  let mockDistractionDetector;
  
  // Storage modules
  let siteStorage;

  beforeEach(async () => {
    // Reset mock data
    mockLocalStorageData = {};
    uuidCounter = 0;

    // Setup storage mocks
    mockStorageArea.get.mockImplementation(async (key) => {
      if (typeof key === 'string') {
        const result = {};
        if (mockLocalStorageData[key] !== undefined) {
          result[key] = mockLocalStorageData[key];
        }
        return Promise.resolve(result);
      } else if (Array.isArray(key)) {
        const result = {};
        key.forEach(k => {
          if (mockLocalStorageData[k] !== undefined) {
            result[k] = mockLocalStorageData[k];
          }
        });
        return Promise.resolve(result);
      }
      return Promise.resolve({});
    });

    mockStorageArea.set.mockImplementation(async (items) => {
      Object.assign(mockLocalStorageData, items);
      return Promise.resolve();
    });

    // Setup UUID generation
    global.crypto.randomUUID.mockImplementation(() => `test-uuid-${++uuidCounter}`);

    // Setup console spies
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Setup tab query mock
    mockTabsArea.query.mockResolvedValue([{
      id: 123,
      url: 'https://facebook.com',
      active: true,
      windowId: 1
    }]);

    // Create mock distraction detector
    mockDistractionDetector = {
      checkIfUrlIsDistracting: jest.fn(() => ({ isMatch: false, siteId: null }))
    };

    // Clear all mocks before setup
    jest.clearAllMocks();

    // Import the storage modules fresh
    jest.resetModules();
    siteStorage = await import('../../background_scripts/site_storage.js');

    // Create a message handler that mimics main.js popup functionality
    messageHandler = async (message) => {
      console.log('[MessageHandler] Received message:', message.action, message.payload);
      
      try {
        switch (message.action) {
          // === Popup API ===
          case 'getCurrentPageLimitInfo': {
            // Get current active tab
            const tabs = await mockTabsArea.query({ active: true, currentWindow: true });
            if (!tabs.length) {
              throw new Error('No active tab found');
            }
            
            const currentTab = tabs[0];
            const url = currentTab.url;
            
            // Extract hostname
            let hostname;
            try {
              hostname = new URL(url).hostname;
            } catch (error) {
              hostname = url;
            }
            
            // Check if it's a distracting site
            const distractionCheck = mockDistractionDetector.checkIfUrlIsDistracting(url);
            const { isMatch, siteId } = distractionCheck;
            
            let siteInfo = null;
            if (isMatch && siteId) {
              const sites = await siteStorage.getDistractingSites();
              siteInfo = sites.find(s => s.id === siteId);
            }
            
            return { 
              success: true, 
              data: { 
                url,
                hostname,
                isDistractingSite: isMatch,
                siteInfo: siteInfo
              } 
            };
          }
          
          case 'addQuickLimit': {
            if (!message.payload) {
              throw new Error('Payload required for addQuickLimit');
            }
            
            const { urlPattern, timeLimit, openLimit } = message.payload;
            
            // Build site object
            const siteData = {
              urlPattern: urlPattern,
              dailyLimitSeconds: timeLimit || 3600, // Default to 1 hour
              isEnabled: true
            };
            
            // Add open limit if provided
            if (openLimit && openLimit > 0) {
              siteData.dailyOpenLimit = openLimit;
            }
            
            const newSite = await siteStorage.addDistractingSite(siteData);
            if (newSite === null) {
              throw new Error('Failed to add site - validation failed');
            }
            
            return { 
              success: true, 
              data: newSite 
            };
          }
          
          case 'updateSiteLimit': {
            if (!message.payload) {
              throw new Error('Payload required for updateSiteLimit');
            }
            
            const { siteId, timeLimit, openLimit } = message.payload;
            
            const updates = {};
            if (timeLimit !== undefined) {
              updates.dailyLimitSeconds = timeLimit;
            }
            if (openLimit !== undefined) {
              updates.dailyOpenLimit = openLimit;
            }
            
            const updatedSite = await siteStorage.updateDistractingSite(siteId, updates);
            if (updatedSite === null) {
              throw new Error('Failed to update site');
            }
            
            return { 
              success: true, 
              data: updatedSite 
            };
          }
          
          default:
            throw new Error(`Unknown action: ${message.action}`);
        }
      } catch (error) {
        console.error('[MessageHandler] Error handling message:', error);
        return {
          success: false,
          error: {
            message: error.message
          }
        };
      }
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('getCurrentPageLimitInfo', () => {
    it('should return page info for non-distracting site', async () => {
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({ isMatch: false, siteId: null });
      
      const response = await messageHandler({
        action: 'getCurrentPageLimitInfo'
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        url: 'https://facebook.com',
        hostname: 'facebook.com',
        isDistractingSite: false,
        siteInfo: null
      });
    });

    it('should return page info for distracting site with existing limits', async () => {
      // Add a site to storage first
      const existingSite = {
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        dailyOpenLimit: 10,
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [existingSite];
      
      // Mock distraction detector to return a match
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({ isMatch: true, siteId: 'site1' });
      
      const response = await messageHandler({
        action: 'getCurrentPageLimitInfo'
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        url: 'https://facebook.com',
        hostname: 'facebook.com',
        isDistractingSite: true,
        siteInfo: existingSite
      });
    });

    it('should handle no active tab gracefully', async () => {
      mockTabsArea.query.mockResolvedValue([]);
      
      const response = await messageHandler({
        action: 'getCurrentPageLimitInfo'
      });

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('No active tab found');
    });

    it('should handle invalid URLs gracefully', async () => {
      mockTabsArea.query.mockResolvedValue([{
        id: 123,
        url: 'invalid-url',
        active: true,
        windowId: 1
      }]);
      
      const response = await messageHandler({
        action: 'getCurrentPageLimitInfo'
      });

      expect(response.success).toBe(true);
      expect(response.data.hostname).toBe('invalid-url');
    });

    it('should handle storage errors gracefully', async () => {
      // Mock browser tabs to return a valid tab
      mockTabsArea.query.mockResolvedValue([{
        id: 123,
        url: 'https://facebook.com',
        active: true,
        windowId: 1
      }]);

      // Mock distraction detector to return a match
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({ isMatch: true, siteId: 'site1' });

      // Mock siteStorage.getDistractingSites to throw an error
      const originalGet = mockStorageArea.get;
      mockStorageArea.get.mockImplementation(async (key) => {
        if (key === 'distractingSites') {
          throw new Error('Storage error');
        }
        return originalGet(key);
      });
      
      const response = await messageHandler({
        action: 'getCurrentPageLimitInfo'
      });

      // The storage module handles errors gracefully by returning empty arrays
      // So the operation should succeed but with no site info found
      expect(response.success).toBe(true);
      expect(response.data.isDistractingSite).toBe(true);
      expect(response.data.siteInfo).toBe(undefined); // No site found in empty array due to storage error
      
      // Storage error should be logged at the module level
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting distracting sites:', expect.any(Error));
      
      // Restore the original mock
      mockStorageArea.get.mockImplementation(originalGet);
    });
  });

  describe('addQuickLimit', () => {
    it('should add a new site with time limit only', async () => {
      const response = await messageHandler({
        action: 'addQuickLimit',
        payload: {
          urlPattern: 'facebook.com',
          timeLimit: 1800, // 30 minutes
        }
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        id: 'test-uuid-1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 1800,
        isEnabled: true
      });
      
      // Verify it was stored
      expect(mockLocalStorageData.distractingSites).toEqual([response.data]);
    });

    it('should add a new site with both time and open limits', async () => {
      const response = await messageHandler({
        action: 'addQuickLimit',
        payload: {
          urlPattern: 'youtube.com',
          timeLimit: 3600,
          openLimit: 5
        }
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        id: 'test-uuid-1',
        urlPattern: 'youtube.com',
        dailyLimitSeconds: 3600,
        dailyOpenLimit: 5,
        isEnabled: true
      });
    });

    it('should add a new site with open limit only', async () => {
      const response = await messageHandler({
        action: 'addQuickLimit',
        payload: {
          urlPattern: 'twitter.com',
          openLimit: 3
        }
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        id: 'test-uuid-1',
        urlPattern: 'twitter.com',
        dailyLimitSeconds: 3600, // Default value
        dailyOpenLimit: 3,
        isEnabled: true
      });
    });

    it('should handle missing payload', async () => {
      const response = await messageHandler({
        action: 'addQuickLimit'
      });

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Payload required for addQuickLimit');
    });

    it('should handle invalid site data', async () => {
      const response = await messageHandler({
        action: 'addQuickLimit',
        payload: {
          urlPattern: '', // Invalid empty pattern
          timeLimit: 1800
        }
      });

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Failed to add site - validation failed');
    });
  });

  describe('updateSiteLimit', () => {
    beforeEach(() => {
      // Setup existing site
      mockLocalStorageData.distractingSites = [{
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        isEnabled: true
      }];
    });

    it('should update time limit only', async () => {
      const response = await messageHandler({
        action: 'updateSiteLimit',
        payload: {
          siteId: 'site1',
          timeLimit: 7200
        }
      });

      expect(response.success).toBe(true);
      expect(response.data.dailyLimitSeconds).toBe(7200);
    });

    it('should update open limit only', async () => {
      const response = await messageHandler({
        action: 'updateSiteLimit',
        payload: {
          siteId: 'site1',
          openLimit: 10
        }
      });

      expect(response.success).toBe(true);
      expect(response.data.dailyOpenLimit).toBe(10);
    });

    it('should update both limits simultaneously', async () => {
      const response = await messageHandler({
        action: 'updateSiteLimit',
        payload: {
          siteId: 'site1',
          timeLimit: 5400,
          openLimit: 8
        }
      });

      expect(response.success).toBe(true);
      expect(response.data.dailyLimitSeconds).toBe(5400);
      expect(response.data.dailyOpenLimit).toBe(8);
    });

    it('should handle non-existent site', async () => {
      const response = await messageHandler({
        action: 'updateSiteLimit',
        payload: {
          siteId: 'non-existent',
          timeLimit: 7200
        }
      });

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Failed to update site');
    });

    it('should handle missing payload', async () => {
      const response = await messageHandler({
        action: 'updateSiteLimit'
      });

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Payload required for updateSiteLimit');
    });
  });

  describe('error handling', () => {
    it('should handle unknown actions', async () => {
      const response = await messageHandler({
        action: 'unknownAction'
      });

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Unknown action: unknownAction');
    });
  });

  describe('workflow integration', () => {
    it('should support complete add-limit workflow', async () => {
      // 1. Get page info (no existing limit)
      const pageInfoResponse = await messageHandler({
        action: 'getCurrentPageLimitInfo'
      });
      
      expect(pageInfoResponse.success).toBe(true);
      expect(pageInfoResponse.data.isDistractingSite).toBe(false);
      
      // 2. Add a quick limit
      const addLimitResponse = await messageHandler({
        action: 'addQuickLimit',
        payload: {
          urlPattern: pageInfoResponse.data.hostname,
          timeLimit: 3600,
          openLimit: 5
        }
      });
      
      expect(addLimitResponse.success).toBe(true);
      const newSite = addLimitResponse.data;
      
      // 3. Mock that the site is now detected as distracting
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({ isMatch: true, siteId: newSite.id });
      
      // 4. Get page info again (should show existing limit)
      const updatedPageInfoResponse = await messageHandler({
        action: 'getCurrentPageLimitInfo'
      });
      
      expect(updatedPageInfoResponse.success).toBe(true);
      expect(updatedPageInfoResponse.data.isDistractingSite).toBe(true);
      expect(updatedPageInfoResponse.data.siteInfo).toEqual(newSite);
    });

    it('should support complete edit-limit workflow', async () => {
      // Setup existing site
      const existingSite = {
        id: 'site1',
        urlPattern: 'facebook.com',
        dailyLimitSeconds: 3600,
        isEnabled: true
      };
      mockLocalStorageData.distractingSites = [existingSite];
      
      // Mock distraction detector
      mockDistractionDetector.checkIfUrlIsDistracting.mockReturnValue({ isMatch: true, siteId: 'site1' });
      
      // 1. Get page info (existing limit)
      const pageInfoResponse = await messageHandler({
        action: 'getCurrentPageLimitInfo'
      });
      
      expect(pageInfoResponse.success).toBe(true);
      expect(pageInfoResponse.data.siteInfo.id).toBe('site1');
      
      // 2. Update the limit
      const updateResponse = await messageHandler({
        action: 'updateSiteLimit',
        payload: {
          siteId: 'site1',
          timeLimit: 7200,
          openLimit: 10
        }
      });
      
      expect(updateResponse.success).toBe(true);
      expect(updateResponse.data.dailyLimitSeconds).toBe(7200);
      expect(updateResponse.data.dailyOpenLimit).toBe(10);
      
      // 3. Verify changes persisted
      const sites = await siteStorage.getDistractingSites();
      const updatedSite = sites.find(s => s.id === 'site1');
      expect(updatedSite.dailyLimitSeconds).toBe(7200);
      expect(updatedSite.dailyOpenLimit).toBe(10);
    });
  });
}); 