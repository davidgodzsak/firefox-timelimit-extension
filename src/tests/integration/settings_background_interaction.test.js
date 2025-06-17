/**
 * @file settings_background_interaction.test.js
 * @description Integration tests for Settings UI <-> Background Script communication
 * 
 * Tests verify that:
 * - Settings UI messages flow correctly through the storage layer
 * - Message actions result in proper storage operations through real storage modules
 * - Data validation and error handling work correctly in the integration
 * - Cross-module interactions work as expected
 * - Complete workflows work end-to-end
 * 
 * This test simulates the message handler layer but uses the real storage modules
 * to provide meaningful integration testing without the complexity of full main.js initialization.
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
};

const mockAlarmsArea = {
  create: jest.fn(),
  get: jest.fn(),
  clear: jest.fn(),
  onAlarm: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
};

const mockTabsArea = {
  onActivated: { 
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onUpdated: { 
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onRemoved: { 
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  update: jest.fn(),
  query: jest.fn(),
  get: jest.fn(),
};

const mockWindowsArea = {
  onFocusChanged: { 
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  getCurrent: jest.fn(),
};

global.browser = {
  storage: {
    local: mockStorageArea,
  },
  runtime: mockRuntimeArea,
  tabs: mockTabsArea,
  windows: mockWindowsArea,
  alarms: mockAlarmsArea,
  webNavigation: {
    onCommitted: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};

// Mock crypto for ID generation
global.crypto = {
  randomUUID: jest.fn(),
};

// Mock Date for consistent date strings
const mockDate = new Date('2024-01-15T10:30:00Z');
global.Date = class extends Date {
  constructor() {
    super();
    return mockDate;
  }
  static now() {
    return mockDate.getTime();
  }
};

describe('Settings UI <-> Background Integration (Storage Layer)', () => {
  let mockLocalStorageData;
  let messageHandler;
  let consoleErrorSpy;
  let consoleLogSpy;
  let consoleWarnSpy;
  let uuidCounter;
  
  // Storage modules
  let siteStorage;
  let noteStorage;

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
      } else if (key === null || key === undefined) {
        return Promise.resolve({ ...mockLocalStorageData });
      }
      return Promise.resolve({});
    });

    mockStorageArea.set.mockImplementation(async (items) => {
      Object.assign(mockLocalStorageData, items);
      return Promise.resolve();
    });

    mockStorageArea.remove.mockImplementation(async (keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => delete mockLocalStorageData[key]);
      return Promise.resolve();
    });

    // Setup UUID generation
    global.crypto.randomUUID.mockImplementation(() => `test-uuid-${++uuidCounter}`);

    // Setup console spies
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Clear all mocks before setup
    jest.clearAllMocks();

    // Import the storage modules fresh
    jest.resetModules();
    siteStorage = await import('../../background_scripts/site_storage.js');
    noteStorage = await import('../../background_scripts/note_storage.js');

    // Create a message handler that mimics main.js but uses the real storage modules
    messageHandler = async (message) => {
      console.log('[MessageHandler] Received message:', message.action, message.payload);
      
      try {
        switch (message.action) {
          // === Settings API ===
          case 'getAllSettings': {
            const [distractingSites, timeoutNotes] = await Promise.all([
              siteStorage.getDistractingSites(),
              noteStorage.getTimeoutNotes()
            ]);
            return { 
              success: true, 
              data: { distractingSites, timeoutNotes } 
            };
          }
          
          // === Distracting Sites Management ===
          case 'addDistractingSite': {
            if (!message.payload) {
              throw new Error('Payload required for addDistractingSite');
            }
            const newSite = await siteStorage.addDistractingSite(message.payload);
            if (newSite === null) {
              throw new Error('Failed to add site - validation failed');
            }
            return { 
              success: true, 
              data: newSite 
            };
          }
          
          case 'updateDistractingSite': {
            if (!message.payload || !message.payload.id) {
              throw new Error('Payload with id required for updateDistractingSite');
            }
            const updatedSite = await siteStorage.updateDistractingSite(message.payload.id, message.payload.updates);
            if (updatedSite === null) {
              throw new Error('Failed to update site - site not found or validation failed');
            }
            return { 
              success: true, 
              data: updatedSite 
            };
          }
          
          case 'deleteDistractingSite': {
            if (!message.payload || !message.payload.id) {
              throw new Error('Payload with id required for deleteDistractingSite');
            }
            const deleteResult = await siteStorage.deleteDistractingSite(message.payload.id);
            return { 
              success: true, 
              data: deleteResult 
            };
          }
          
          // === Timeout Notes Management ===
          case 'addTimeoutNote': {
            if (!message.payload) {
              throw new Error('Payload required for addTimeoutNote');
            }
            const newNote = await noteStorage.addTimeoutNote(message.payload);
            if (newNote === null) {
              throw new Error('Failed to add note - validation failed');
            }
            return { 
              success: true, 
              data: newNote 
            };
          }
          
          case 'updateTimeoutNote': {
            if (!message.payload || !message.payload.id) {
              throw new Error('Payload with id required for updateTimeoutNote');
            }
            const updatedNote = await noteStorage.updateTimeoutNote(message.payload.id, message.payload.updates);
            if (updatedNote === null) {
              throw new Error('Failed to update note - note not found or validation failed');
            }
            return { 
              success: true, 
              data: updatedNote 
            };
          }
          
          case 'deleteTimeoutNote': {
            if (!message.payload || !message.payload.id) {
              throw new Error('Payload with id required for deleteTimeoutNote');
            }
            const deleteResult = await noteStorage.deleteTimeoutNote(message.payload.id);
            return { 
              success: true, 
              data: deleteResult 
            };
          }
          
          // === Timeout Page API ===
          case 'getTimeoutNotes': {
            const notes = await noteStorage.getTimeoutNotes();
            return { 
              success: true, 
              data: notes 
            };
          }
          
          case 'getRandomTimeoutNote': {
            const notes = await noteStorage.getTimeoutNotes();
            if (notes && notes.length > 0) {
              const randomIndex = Math.floor(Math.random() * notes.length);
              return { 
                success: true, 
                data: notes[randomIndex] 
              };
            }
            return { 
              success: true, 
              data: null 
            };
          }
          
          default:
            console.warn('[MessageHandler] Unknown message action:', message.action);
            return { 
              success: false, 
              error: `Unknown action: ${message.action}` 
            };
        }
      } catch (error) {
        console.error('[MessageHandler] Error handling message:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }
    };

    // Clear mocks again after setup for clean test runs
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Storage Integration via Message Handler', () => {
    it('should handle getAllSettings through real storage modules', async () => {
      // Setup test data
      mockLocalStorageData.distractingSites = [
        { id: 'site1', urlPattern: 'facebook.com', dailyLimitSeconds: 3600, isEnabled: true }
      ];
      mockLocalStorageData.timeoutNotes = [
        { id: 'note1', text: 'Go for a walk' }
      ];

      const message = { action: 'getAllSettings' };
      const response = await messageHandler(message);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        distractingSites: mockLocalStorageData.distractingSites,
        timeoutNotes: mockLocalStorageData.timeoutNotes
      });
      
      // Verify storage was actually accessed
      expect(mockStorageArea.get).toHaveBeenCalledWith('distractingSites');
      expect(mockStorageArea.get).toHaveBeenCalledWith('timeoutNotes');
    });

    it('should handle addDistractingSite with real validation and storage', async () => {
      const siteData = {
        urlPattern: 'youtube.com',
        dailyLimitSeconds: 1800,
        isEnabled: true
      };

      const message = {
        action: 'addDistractingSite',
        payload: siteData
      };

      const response = await messageHandler(message);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        id: 'test-uuid-1',
        ...siteData
      });
      
      // Verify data was actually stored
      expect(mockLocalStorageData.distractingSites).toEqual([{
        id: 'test-uuid-1',
        ...siteData
      }]);
      expect(mockStorageArea.set).toHaveBeenCalledWith({
        distractingSites: expect.arrayContaining([
          expect.objectContaining(siteData)
        ])
      });
    });

    it('should handle real validation errors from storage modules', async () => {
      const invalidSiteData = {
        dailyLimitSeconds: 1800  // Missing required urlPattern
      };

      const message = {
        action: 'addDistractingSite',
        payload: invalidSiteData
      };

      const response = await messageHandler(message);

      expect(response).toBeDefined();
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to add site - validation failed');
      
      // Verify no invalid data was stored
      expect(mockLocalStorageData.distractingSites).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled(); // Storage module should log validation error
    });

    it('should handle missing payloads correctly', async () => {
      const testCases = [
        { action: 'addDistractingSite' },
        { action: 'addTimeoutNote' },
        { action: 'updateDistractingSite', payload: { updates: {} } }, // Missing id
        { action: 'updateTimeoutNote', payload: { updates: {} } }, // Missing id
        { action: 'deleteDistractingSite' }, // Missing payload
        { action: 'deleteTimeoutNote' } // Missing payload
      ];

      for (const message of testCases) {
        const response = await messageHandler(message);
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        expect(response.error).toContain('required');
      }
    });

    it('should handle unknown action with proper error response', async () => {
      const message = { action: 'unknownAction' };
      const response = await messageHandler(message);

      expect(response).toBeDefined();
      expect(response.success).toBe(false);
      expect(response.error).toBe('Unknown action: unknownAction');
    });
  });

  describe('Cross-Module Data Flow Integration', () => {
    it('should handle concurrent operations on different data types', async () => {
      // Test that site and note operations don't interfere with each other
      const sitePromise = messageHandler({
        action: 'addDistractingSite',
        payload: { urlPattern: 'facebook.com', dailyLimitSeconds: 3600, isEnabled: true }
      });

      const notePromise = messageHandler({
        action: 'addTimeoutNote',
        payload: { text: 'Go for a walk' }
      });

      const [siteResponse, noteResponse] = await Promise.all([sitePromise, notePromise]);

      expect(siteResponse.success).toBe(true);
      expect(noteResponse.success).toBe(true);

      // Verify both were stored correctly
      const getAllResponse = await messageHandler({ action: 'getAllSettings' });
      expect(getAllResponse.data.distractingSites).toHaveLength(1);
      expect(getAllResponse.data.timeoutNotes).toHaveLength(1);
    });

    it('should provide random timeout note functionality for timeout page integration', async () => {
      // Setup multiple notes
      const notes = [
        { text: 'Go for a walk' },
        { text: 'Read a book' },
        { text: 'Practice meditation' }
      ];

      // Add notes through the actual system
      for (const noteData of notes) {
        const response = await messageHandler({
          action: 'addTimeoutNote',
          payload: noteData
        });
        expect(response.success).toBe(true);
      }

      // Test getRandomTimeoutNote multiple times to ensure it works
      for (let i = 0; i < 5; i++) {
        const response = await messageHandler({ action: 'getRandomTimeoutNote' });
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.data.text).toBeDefined();
        
        // Should be one of our added notes
        const noteTexts = notes.map(n => n.text);
        expect(noteTexts).toContain(response.data.text);
      }
    });

    it('should handle storage errors gracefully across all operations', async () => {
      // Test storage failure for different operation types
      const testCases = [
        { action: 'addDistractingSite', payload: { urlPattern: 'test.com', dailyLimitSeconds: 3600, isEnabled: true } },
        { action: 'addTimeoutNote', payload: { text: 'Test note' } }
      ];

      for (const testCase of testCases) {
        // Force storage error for this operation
        mockStorageArea.set.mockRejectedValueOnce(new Error('Storage write failed'));

        const response = await messageHandler(testCase);

        expect(response.success).toBe(false);
        expect(response.error).toBe(testCase.action.includes('Site') ? 
          'Failed to add site - validation failed' : 
          'Failed to add note - validation failed'
        );
        
        // Should have logged the error at storage level
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        // Reset error spy for next iteration
        consoleErrorSpy.mockClear();
      }
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should support complete site management workflow', async () => {
      // 1. Start with empty settings
      let response = await messageHandler({ action: 'getAllSettings' });
      expect(response.data.distractingSites).toEqual([]);

      // 2. Add a site
      response = await messageHandler({
        action: 'addDistractingSite',
        payload: { urlPattern: 'facebook.com', dailyLimitSeconds: 3600, isEnabled: true }
      });
      expect(response.success).toBe(true);
      const siteId = response.data.id;

      // 3. Verify site exists
      response = await messageHandler({ action: 'getAllSettings' });
      expect(response.data.distractingSites).toHaveLength(1);
      expect(response.data.distractingSites[0].urlPattern).toBe('facebook.com');

      // 4. Update the site
      response = await messageHandler({
        action: 'updateDistractingSite',
        payload: { id: siteId, updates: { dailyLimitSeconds: 1800 } }
      });
      expect(response.success).toBe(true);
      expect(response.data.dailyLimitSeconds).toBe(1800);

      // 5. Delete the site
      response = await messageHandler({
        action: 'deleteDistractingSite',
        payload: { id: siteId }
      });
      expect(response.success).toBe(true);
      expect(response.data).toBe(true);

      // 6. Verify site is gone
      response = await messageHandler({ action: 'getAllSettings' });
      expect(response.data.distractingSites).toEqual([]);
    });

    it('should maintain data consistency across complex operations', async () => {
      // Complex scenario: multiple sites and notes with updates and deletions
      const sites = [
        { urlPattern: 'facebook.com', dailyLimitSeconds: 3600, isEnabled: true },
        { urlPattern: 'youtube.com', dailyLimitSeconds: 1800, isEnabled: false },
        { urlPattern: 'twitter.com', dailyLimitSeconds: 2700, isEnabled: true }
      ];

      const notes = [
        { text: 'Go for a walk' },
        { text: 'Read a book' },
        { text: 'Call a friend' }
      ];

      const siteIds = [];
      const noteIds = [];

      // Add all sites and notes
      for (const siteData of sites) {
        const response = await messageHandler({ action: 'addDistractingSite', payload: siteData });
        expect(response.success).toBe(true);
        siteIds.push(response.data.id);
      }

      for (const noteData of notes) {
        const response = await messageHandler({ action: 'addTimeoutNote', payload: noteData });
        expect(response.success).toBe(true);
        noteIds.push(response.data.id);
      }

      // Verify all data is present
      let getAllResponse = await messageHandler({ action: 'getAllSettings' });
      expect(getAllResponse.data.distractingSites).toHaveLength(3);
      expect(getAllResponse.data.timeoutNotes).toHaveLength(3);

      // Perform operations sequentially to avoid race conditions in the test
      // Update one site
      const updateSiteResponse = await messageHandler({ 
        action: 'updateDistractingSite', 
        payload: { id: siteIds[0], updates: { isEnabled: false } } 
      });
      expect(updateSiteResponse.success).toBe(true);

      // Delete one note
      const deleteNoteResponse = await messageHandler({ 
        action: 'deleteTimeoutNote', 
        payload: { id: noteIds[1] } 
      });
      expect(deleteNoteResponse.success).toBe(true);

      // Update another note
      const updateNoteResponse = await messageHandler({ 
        action: 'updateTimeoutNote', 
        payload: { id: noteIds[0], updates: { text: 'Take a long walk' } } 
      });
      expect(updateNoteResponse.success).toBe(true);

      // Delete one site
      const deleteSiteResponse = await messageHandler({ 
        action: 'deleteDistractingSite', 
        payload: { id: siteIds[2] } 
      });
      expect(deleteSiteResponse.success).toBe(true);

      // Verify final state
      getAllResponse = await messageHandler({ action: 'getAllSettings' });
      expect(getAllResponse.data.distractingSites).toHaveLength(2);
      expect(getAllResponse.data.timeoutNotes).toHaveLength(2);
      
      // Verify specific changes
      const updatedSite = getAllResponse.data.distractingSites.find(s => s.id === siteIds[0]);
      expect(updatedSite.isEnabled).toBe(false);
      
      const updatedNote = getAllResponse.data.timeoutNotes.find(n => n.id === noteIds[0]);
      expect(updatedNote.text).toBe('Take a long walk');
      
      // Verify deletions
      const remainingSiteIds = getAllResponse.data.distractingSites.map(s => s.id);
      const remainingNoteIds = getAllResponse.data.timeoutNotes.map(n => n.id);
      expect(remainingSiteIds).not.toContain(siteIds[2]);
      expect(remainingNoteIds).not.toContain(noteIds[1]);
    });

    it('should handle edge cases in workflows', async () => {
      // Test edge cases like updating non-existent items, etc.
      
      // Try to update non-existent site
      let response = await messageHandler({
        action: 'updateDistractingSite',
        payload: { id: 'non-existent', updates: { dailyLimitSeconds: 1800 } }
      });
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to update site - site not found or validation failed');

      // Try to delete non-existent note
      response = await messageHandler({
        action: 'deleteTimeoutNote',
        payload: { id: 'non-existent' }
      });
      expect(response.success).toBe(true);
      expect(response.data).toBe(false); // Should return false for not found

      // Add a site
      response = await messageHandler({
        action: 'addDistractingSite',
        payload: { urlPattern: 'facebook.com', dailyLimitSeconds: 3600, isEnabled: true }
      });
      expect(response.success).toBe(true);

      // The storage modules actually allow duplicate URL patterns, so this should succeed
      response = await messageHandler({
        action: 'addDistractingSite',
        payload: { urlPattern: 'facebook.com', dailyLimitSeconds: 1800, isEnabled: false }
      });
      expect(response.success).toBe(true); // Should succeed because duplicates are allowed
      
      // Verify both sites exist
      const getAllResponse = await messageHandler({ action: 'getAllSettings' });
      expect(getAllResponse.data.distractingSites).toHaveLength(2);
      expect(getAllResponse.data.distractingSites.filter(s => s.urlPattern === 'facebook.com')).toHaveLength(2);
    });
  });

  describe('Data Validation Integration', () => {
    it('should enforce real validation rules across the integration', async () => {
      // Test various validation scenarios that should be caught by storage modules
      const invalidSiteTests = [
        { payload: { dailyLimitSeconds: 3600, isEnabled: true }, error: 'urlPattern required' },
        { payload: { urlPattern: '', dailyLimitSeconds: 3600, isEnabled: true }, error: 'empty urlPattern' },
        { payload: { urlPattern: 'test.com', dailyLimitSeconds: -100, isEnabled: true }, error: 'negative limit' },
        { payload: { urlPattern: 'test.com', dailyLimitSeconds: 'invalid', isEnabled: true }, error: 'invalid limit type' },
      ];

      for (const test of invalidSiteTests) {
        const response = await messageHandler({
          action: 'addDistractingSite',
          payload: test.payload
        });
        expect(response.success).toBe(false);
        expect(response.error).toBe('Failed to add site - validation failed');
      }

      const invalidNoteTests = [
        { payload: { text: '' }, error: 'empty text' },
        { payload: { text: null }, error: 'null text' },
        { payload: { text: 123 }, error: 'non-string text' },
      ];

      for (const test of invalidNoteTests) {
        const response = await messageHandler({
          action: 'addTimeoutNote',
          payload: test.payload
        });
        expect(response.success).toBe(false);
        expect(response.error).toBe('Failed to add note - validation failed');
      }
    });
  });
}); 