/**
 * @file tab_activity_monitor.test.js
 * @description Unit tests for the tab activity monitor module.
 */

import { jest } from '@jest/globals';

// Mock the browser API
const mockBrowser = {
  tabs: {
    onActivated: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
    get: jest.fn(),
    query: jest.fn(),
  },
  windows: {
    onFocusChanged: { addListener: jest.fn() },
    getCurrent: jest.fn(),
    WINDOW_ID_NONE: -1,
  },
};

global.browser = mockBrowser;

// Import after setting up mock
import {
  initializeTabActivityMonitor,
  getActiveTabDetails,
  getBrowserFocusState,
} from '../../../background_scripts/tab_activity_monitor.js';

describe('TabActivityMonitor', () => {
  let activityCallback;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    activityCallback = jest.fn();

    // Default mock implementations
    mockBrowser.windows.getCurrent.mockResolvedValue({ focused: true });
    mockBrowser.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com' },
    ]);
  });

  describe('initialization', () => {
    it('should set up event listeners', async () => {
      await initializeTabActivityMonitor(activityCallback);

      expect(mockBrowser.tabs.onActivated.addListener).toHaveBeenCalled();
      expect(mockBrowser.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(mockBrowser.tabs.onRemoved.addListener).toHaveBeenCalled();
      expect(mockBrowser.windows.onFocusChanged.addListener).toHaveBeenCalled();
    });

    it('should initialize with current tab and window state', async () => {
      await initializeTabActivityMonitor(activityCallback);

      expect(mockBrowser.windows.getCurrent).toHaveBeenCalled();
      expect(mockBrowser.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
      expect(activityCallback).toHaveBeenCalledWith({
        tabId: 1,
        url: 'https://example.com',
        isFocused: true,
      });
    });

    it('should handle initialization errors gracefully', async () => {
      // Clear any existing state and mock implementations
      jest.clearAllMocks();
      mockBrowser.windows.getCurrent.mockReset();
      mockBrowser.tabs.query.mockReset();

      // Set up error mocks
      mockBrowser.windows.getCurrent.mockImplementation(() => {
        throw new Error('Test error');
      });
      mockBrowser.tabs.query.mockImplementation(() => {
        throw new Error('Test error');
      });

      await initializeTabActivityMonitor(activityCallback);

      expect(activityCallback).toHaveBeenCalledWith({
        tabId: null,
        url: null,
        isFocused: true,
      });
    });
  });

  describe('tab activation handling', () => {
    it('should update state and notify when tab is activated', async () => {
      await initializeTabActivityMonitor(activityCallback);
      activityCallback.mockClear(); // Clear initial call

      const mockTab = { id: 2, url: 'https://test.com' };
      mockBrowser.tabs.get.mockResolvedValue(mockTab);

      // Get the onActivated listener and call it
      const onActivated = mockBrowser.tabs.onActivated.addListener.mock.calls[0][0];
      await onActivated({ tabId: 2 });

      expect(mockBrowser.tabs.get).toHaveBeenCalledWith(2);
      expect(activityCallback).toHaveBeenCalledWith({
        tabId: 2,
        url: 'https://test.com',
        isFocused: true,
      });
    });

    it('should handle tab activation errors gracefully', async () => {
      await initializeTabActivityMonitor(activityCallback);
      activityCallback.mockClear();

      mockBrowser.tabs.get.mockRejectedValue(new Error('Test error'));

      const onActivated = mockBrowser.tabs.onActivated.addListener.mock.calls[0][0];
      await onActivated({ tabId: 2 });

      expect(activityCallback).toHaveBeenCalledWith({
        tabId: 2,
        url: null,
        isFocused: true,
      });
    });
  });

  describe('tab update handling', () => {
    it('should update state and notify when monitored tab URL changes', async () => {
      await initializeTabActivityMonitor(activityCallback);
      activityCallback.mockClear();

      // Get the onUpdated listener and call it
      const onUpdated = mockBrowser.tabs.onUpdated.addListener.mock.calls[0][0];
      await onUpdated(1, { url: 'https://newurl.com' }, { id: 1, url: 'https://newurl.com' });

      expect(activityCallback).toHaveBeenCalledWith({
        tabId: 1,
        url: 'https://newurl.com',
        isFocused: true,
      });
    });

    it('should not notify when non-monitored tab updates', async () => {
      await initializeTabActivityMonitor(activityCallback);
      activityCallback.mockClear();

      const onUpdated = mockBrowser.tabs.onUpdated.addListener.mock.calls[0][0];
      await onUpdated(2, { url: 'https://other.com' }, { id: 2, url: 'https://other.com' });

      expect(activityCallback).not.toHaveBeenCalled();
    });
  });

  describe('tab removal handling', () => {
    it('should update state and notify when monitored tab is removed', async () => {
      await initializeTabActivityMonitor(activityCallback);
      activityCallback.mockClear();

      const onRemoved = mockBrowser.tabs.onRemoved.addListener.mock.calls[0][0];
      await onRemoved(1);

      expect(activityCallback).toHaveBeenCalledWith({
        tabId: null,
        url: null,
        isFocused: true,
      });
    });

    it('should not notify when non-monitored tab is removed', async () => {
      await initializeTabActivityMonitor(activityCallback);
      activityCallback.mockClear();

      const onRemoved = mockBrowser.tabs.onRemoved.addListener.mock.calls[0][0];
      await onRemoved(2);

      expect(activityCallback).not.toHaveBeenCalled();
    });
  });

  describe('window focus handling', () => {
    it('should update state and notify when window focus changes', async () => {
      await initializeTabActivityMonitor(activityCallback);
      activityCallback.mockClear();

      const onFocusChanged = mockBrowser.windows.onFocusChanged.addListener.mock.calls[0][0];
      await onFocusChanged(mockBrowser.windows.WINDOW_ID_NONE);

      expect(activityCallback).toHaveBeenCalledWith({
        tabId: 1,
        url: 'https://example.com',
        isFocused: false,
      });
    });

    it('should not notify when focus state does not change', async () => {
      await initializeTabActivityMonitor(activityCallback);
      activityCallback.mockClear();

      const onFocusChanged = mockBrowser.windows.onFocusChanged.addListener.mock.calls[0][0];
      await onFocusChanged(1); // Any non-WINDOW_ID_NONE value means focused

      expect(activityCallback).not.toHaveBeenCalled(); // Already focused, no change
    });
  });

  describe('state getters', () => {
    it('should return current tab details', async () => {
      await initializeTabActivityMonitor(activityCallback);

      expect(getActiveTabDetails()).toEqual({
        tabId: 1,
        url: 'https://example.com',
      });
    });

    it('should return current focus state', async () => {
      await initializeTabActivityMonitor(activityCallback);

      expect(getBrowserFocusState()).toBe(true);
    });
  });
}); 