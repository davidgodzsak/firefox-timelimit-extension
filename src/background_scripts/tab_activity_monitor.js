/**
 * @file tab_activity_monitor.js
 * @description Monitors browser tab and window activity (active tab, URL changes, window focus)
 * and notifies a callback function of these changes.
 * This module decouples raw browser event handling from higher-level logic.
 */

let _currentTabInfo = {
  tabId: null,
  url: null,
};
let _isWindowFocused = true;
let _activityChangeCallback = null;

/**
 * Updates the internal state for the current tab and notifies the callback.
 * @param {number|null} tabId - The ID of the active tab.
 * @param {string|null} url - The URL of the active tab.
 */
async function _updateCurrentTabAndNotify(tabId, url) {
  _currentTabInfo.tabId = tabId;
  _currentTabInfo.url = url;
  if (_activityChangeCallback) {
    _activityChangeCallback({
      tabId: _currentTabInfo.tabId,
      url: _currentTabInfo.url,
      isFocused: _isWindowFocused,
    });
  }
}

/**
 * Updates the internal focus state and notifies the callback.
 * @param {boolean} isFocused - The new window focus state.
 */
async function _updateFocusStateAndNotify(isFocused) {
  _isWindowFocused = isFocused;
  if (_activityChangeCallback) {
    _activityChangeCallback({
      tabId: _currentTabInfo.tabId,
      url: _currentTabInfo.url,
      isFocused: _isWindowFocused,
    });
  }
}

/** Handles tab activation events. */
async function _handleTabActivated(activeInfo) {
  console.log(`[TabMonitor] Tab activated: ${activeInfo.tabId}`);
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    await _updateCurrentTabAndNotify(tab.id, tab.url);
  } catch (error) {
    console.warn(`[TabMonitor] Error getting tab info for activated tab ${activeInfo.tabId}:`, error.message);
    await _updateCurrentTabAndNotify(activeInfo.tabId, null); // Update with known ID, null URL
  }
}

/** Handles tab update events. */
async function _handleTabUpdated(tabId, changeInfo, tab) {
  if (tabId === _currentTabInfo.tabId) {
    if (changeInfo.url || (changeInfo.status === 'complete' && tab.url !== _currentTabInfo.url)) {
      const newUrl = changeInfo.url || tab.url;
      console.log(`[TabMonitor] Monitored tab updated: ${tabId}, new URL: ${newUrl}`);
      await _updateCurrentTabAndNotify(tabId, newUrl);
    }
  }
}

/** Handles tab removal events. */
async function _handleTabRemoved(tabId) {
  if (tabId === _currentTabInfo.tabId) {
    console.log(`[TabMonitor] Monitored active tab removed: ${tabId}`);
    await _updateCurrentTabAndNotify(null, null);
  }
}

/** Handles browser window focus changes. */
async function _handleWindowFocusChanged(windowId) {
  const newFocusState = windowId !== browser.windows.WINDOW_ID_NONE;
  if (newFocusState !== _isWindowFocused) {
    console.log(`[TabMonitor] Window focus changed. Focused: ${newFocusState}`);
    await _updateFocusStateAndNotify(newFocusState);
  }
}

/**
 * Initializes the tab activity monitor.
 * Sets up browser event listeners and an initial state check.
 * @param {Function} activityChangeCallback - Callback function to invoke with activity updates.
 *                                          Receives an object: { tabId, url, isFocused }.
 */
export async function initializeTabActivityMonitor(activityChangeCallback) {
  _activityChangeCallback = activityChangeCallback;
  console.log('[TabMonitor] Initializing...');

  // Reset state
  _currentTabInfo = {
    tabId: null,
    url: null,
  };

  // Set initial focus state
  try {
    const currentWindow = await browser.windows.getCurrent({ populate: false }); // Don't need tabs array
    _isWindowFocused = currentWindow && currentWindow.focused;
  } catch (e) {
    console.warn('[TabMonitor] Could not get current window focus state on init:', e.message);
    _isWindowFocused = true; // Assume focused if unable to determine
  }

  // Get initial active tab
  try {
    const [initialTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (initialTab) {
      _currentTabInfo.tabId = initialTab.id;
      _currentTabInfo.url = initialTab.url;
      console.log(`[TabMonitor] Initial state: Tab ${initialTab.id} - ${initialTab.url}, Focused: ${_isWindowFocused}`);
    } else {
      console.log('[TabMonitor] No active tab found on initialization.');
    }
  } catch (error) {
    console.error('[TabMonitor] Error querying initial active tab:', error.message);
    // Keep state reset on error
    _currentTabInfo.tabId = null;
    _currentTabInfo.url = null;
  }

  // Attach event listeners
  browser.tabs.onActivated.addListener(_handleTabActivated);
  browser.tabs.onUpdated.addListener(_handleTabUpdated); // Listen for URL changes and status completion
  browser.tabs.onRemoved.addListener(_handleTabRemoved);
  browser.windows.onFocusChanged.addListener(_handleWindowFocusChanged);

  // Perform initial callback with current state
  if (_activityChangeCallback) {
    _activityChangeCallback({
      tabId: _currentTabInfo.tabId,
      url: _currentTabInfo.url,
      isFocused: _isWindowFocused,
    });
  }
  console.log('[TabMonitor] Initialization complete. Event listeners attached.');
}

/**
 * Gets the last known details of the active tab.
 * @returns {{tabId: number|null, url: string|null}}
 */
export function getActiveTabDetails() {
  return { ..._currentTabInfo };
}

/**
 * Gets the last known browser window focus state.
 * @returns {boolean}
 */
export function getBrowserFocusState() {
  return _isWindowFocused;
}

// Functions to be exported or made available to time_tracker.js (orchestrator)
// e.g. by attaching to a global object if not using ES modules.
// For now, assume initializeTabActivityMonitor will be callable. 