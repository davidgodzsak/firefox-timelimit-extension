/**
 * @file badge_manager.js
 * @description Manages toolbar badge text updates for the extension action button.
 * Shows remaining time and/or opens for distracting sites based on configured limits.
 * Handles tab changes, usage updates, and provides efficient caching to avoid excessive computations.
 */

import { getDistractingSites } from './site_storage.js';
import { getUsageStats } from './usage_storage.js';
import { checkIfUrlIsDistracting } from './distraction_detector.js';
import { categorizeError, safeBrowserApiCall } from './validation_utils.js';

/**
 * Cache for badge text to avoid excessive calculations
 * @private
 */
let _badgeCache = new Map();

/**
 * Debounce configuration for badge updates
 * @private
 */
const DEBOUNCE_CONFIG = {
  UPDATE_DELAY: 250, // ms to wait before processing badge updates
  BATCH_SIZE: 5, // max number of pending updates to batch together
  MAX_WAIT: 1000 // maximum time to wait before forcing an update
};

/**
 * Debounce state management
 * @private
 */
let _debounceState = {
  timer: null,
  pendingUpdates: new Map(), // tabId -> {url, timestamp}
  lastUpdateTime: 0
};

/**
 * Error retry configuration
 * @private
 */
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 500, // ms
  EXPONENTIAL_BACKOFF: true
};

/**
 * Currently active tab information
 * @private
 */
let _currentTabInfo = {
  tabId: null,
  url: null,
  siteId: null
};

/**
 * Returns the current date as a string in "YYYY-MM-DD" format for storage keys.
 * @private
 * @returns {string} The formatted date string.
 */
function _getCurrentDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats remaining time into a concise display format.
 * @private
 * @param {number} remainingSeconds - Remaining time in seconds
 * @returns {string} Formatted time string (e.g., "45m", "2h", "90s")
 */
function _formatRemainingTime(remainingSeconds) {
  if (remainingSeconds <= 0) return "0s";
  
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Formats remaining opens into a concise display format.
 * @private
 * @param {number} remainingOpens - Remaining opens count
 * @returns {string} Formatted opens string (e.g., "5", "12")
 */
function _formatRemainingOpens(remainingOpens) {
  if (remainingOpens <= 0) return "0";
  return remainingOpens.toString();
}

/**
 * Calculates badge text for a specific site based on its limits and current usage.
 * @private
 * @param {Object} site - The site object with limits
 * @param {Object} usageStats - Current usage statistics for the site
 * @returns {string} Badge text to display, or empty string if no limits apply
 */
function _calculateBadgeText(site, usageStats) {
  if (!site || !site.isEnabled) return "";
  
  const siteUsage = usageStats[site.id] || { timeSpentSeconds: 0, opens: 0 };
  const parts = [];
  
  // Calculate remaining time if time limit is set
  if (site.dailyLimitSeconds > 0) {
    const remainingSeconds = Math.max(0, site.dailyLimitSeconds - siteUsage.timeSpentSeconds);
    if (remainingSeconds > 0) {
      parts.push(_formatRemainingTime(remainingSeconds));
    } else {
      parts.push("0s");
    }
  }
  
  // Calculate remaining opens if open limit is set
  if (site.dailyOpenLimit > 0) {
    const remainingOpens = Math.max(0, site.dailyOpenLimit - siteUsage.opens);
    if (remainingOpens > 0) {
      parts.push(_formatRemainingOpens(remainingOpens));
    } else {
      parts.push("0");
    }
  }
  
  // Join parts with a separator if both exist
  if (parts.length > 1) {
    return parts.join('/');
  } else if (parts.length === 1) {
    return parts[0];
  }
  
  return "";
}

/**
 * Updates the badge text for a specific tab.
 * @private
 * @param {number} tabId - The tab ID to update
 * @param {string} text - The badge text to display
 */
async function _setBadgeText(tabId, text) {
  try {
    await browser.action.setBadgeText({
      text: text,
      tabId: tabId
    });
    
    // Set badge background color for better visibility
    if (text) {
      await browser.action.setBadgeBackgroundColor({
        color: [0, 122, 255, 255], // Blue background
        tabId: tabId
      });
    }
  } catch (error) {
    console.error('[BadgeManager] Error setting badge text:', error);
  }
}

/**
 * Enhanced debounced badge update function that batches multiple updates
 * and handles error retries with exponential backoff.
 * @private
 * @param {number} tabId - The tab ID to update
 * @param {string} url - The URL of the tab
 * @param {number} retryCount - Current retry count for error handling
 */
async function _debouncedBadgeUpdate(tabId, url, retryCount = 0) {
  const now = Date.now();
  
  // Add to pending updates
  _debounceState.pendingUpdates.set(tabId, { url, timestamp: now });
  
  // Clear existing timer
  if (_debounceState.timer) {
    clearTimeout(_debounceState.timer);
  }
  
  // Calculate delay based on current conditions
  let delay = DEBOUNCE_CONFIG.UPDATE_DELAY;
  
  // Force update if we have too many pending or waited too long
  const shouldForceUpdate = 
    _debounceState.pendingUpdates.size >= DEBOUNCE_CONFIG.BATCH_SIZE ||
    (now - _debounceState.lastUpdateTime) >= DEBOUNCE_CONFIG.MAX_WAIT;
  
  if (shouldForceUpdate) {
    delay = 10; // Minimal delay for forced updates
  }
  
  // Set new timer
  _debounceState.timer = setTimeout(async () => {
    try {
      // Process all pending updates in batch
      const updates = Array.from(_debounceState.pendingUpdates.entries());
      _debounceState.pendingUpdates.clear();
      _debounceState.lastUpdateTime = Date.now();
      
      // Process updates in parallel for better performance
      const updatePromises = updates.map(([tabId, {url}]) => 
        _processSingleBadgeUpdate(tabId, url, retryCount)
      );
      
      await Promise.allSettled(updatePromises);
      
    } catch (error) {
      console.error('[BadgeManager] Error in debounced batch update:', error);
      
      // Retry logic for critical errors
      if (retryCount < RETRY_CONFIG.MAX_RETRIES) {
        const retryDelay = RETRY_CONFIG.EXPONENTIAL_BACKOFF 
          ? RETRY_CONFIG.RETRY_DELAY * Math.pow(2, retryCount)
          : RETRY_CONFIG.RETRY_DELAY;
        
        console.warn(`[BadgeManager] Retrying badge update in ${retryDelay}ms (attempt ${retryCount + 1})`);
        
        setTimeout(() => {
          _debouncedBadgeUpdate(tabId, url, retryCount + 1);
        }, retryDelay);
      } else {
        console.error('[BadgeManager] Max retries exceeded for badge update');
      }
    } finally {
      _debounceState.timer = null;
    }
  }, delay);
}

/**
 * Processes a single badge update with comprehensive error handling.
 * @private
 * @param {number} tabId - The tab ID to update
 * @param {string} url - The URL of the tab
 * @param {number} retryCount - Current retry count
 */
async function _processSingleBadgeUpdate(tabId, url, retryCount = 0) {
  if (!tabId || !url) {
    console.warn('[BadgeManager] Invalid parameters for badge update:', { tabId, url });
    return;
  }
  
  try {
    // Check if URL is a distracting site
    const distractionCheck = checkIfUrlIsDistracting(url);
    const { isMatch, siteId } = distractionCheck;
    
    if (!isMatch || !siteId) {
      // Not a distracting site, clear badge
      await _setBadgeTextSafely(tabId, "");
      return;
    }
    
    // Check cache first with enhanced cache validation
    const cacheKey = `${siteId}-${_getCurrentDateString()}`;
    const cachedEntry = _badgeCache.get(cacheKey);
    
    if (cachedEntry && _isCacheEntryValid(cachedEntry)) {
      await _setBadgeTextSafely(tabId, cachedEntry.text);
      return;
    }
    
    // Get site and usage data with error handling
    const [sitesResult, usageResult] = await Promise.allSettled([
      safeBrowserApiCall(() => getDistractingSites(), [], 'Get distracting sites'),
      safeBrowserApiCall(() => getUsageStats(_getCurrentDateString()), [], 'Get usage stats')
    ]);
    
    // Handle errors in data fetching
    if (sitesResult.status === 'rejected' || !sitesResult.value.success) {
      throw new Error('Failed to fetch distracting sites data');
    }
    
    if (usageResult.status === 'rejected' || !usageResult.value.success) {
      console.warn('[BadgeManager] Failed to fetch usage stats, using empty data');
      // Continue with empty usage data rather than failing completely
    }
    
    const sites = sitesResult.value.data || [];
    const usageStats = usageResult.value?.data || {};
    
    const site = sites.find(s => s.id === siteId);
    if (!site) {
      await _setBadgeTextSafely(tabId, "");
      return;
    }
    
    // Calculate badge text
    const badgeText = _calculateBadgeText(site, usageStats);
    
    // Cache the result with expiration
    _setCacheEntry(cacheKey, badgeText);
    
    // Update badge
    await _setBadgeTextSafely(tabId, badgeText);
    
  } catch (error) {
    const categorized = categorizeError(error);
    console.error('[BadgeManager] Error in badge update:', {
      tabId,
      url,
      error: error.message,
      type: categorized.type,
      retryCount
    });
    
    // Only retry for retryable errors
    if (categorized.isRetryable && retryCount < RETRY_CONFIG.MAX_RETRIES) {
      const retryDelay = RETRY_CONFIG.EXPONENTIAL_BACKOFF 
        ? RETRY_CONFIG.RETRY_DELAY * Math.pow(2, retryCount)
        : RETRY_CONFIG.RETRY_DELAY;
      
      setTimeout(() => {
        _processSingleBadgeUpdate(tabId, url, retryCount + 1);
      }, retryDelay);
    } else {
      // Clear badge on unrecoverable errors
      await _setBadgeTextSafely(tabId, "");
    }
  }
}

/**
 * Enhanced cache entry management with expiration and validation.
 * @private
 * @param {string} key - Cache key
 * @param {string} text - Badge text to cache
 */
function _setCacheEntry(key, text) {
  const entry = {
    text,
    timestamp: Date.now(),
    expires: Date.now() + 30000 // 30 seconds TTL
  };
  
  _badgeCache.set(key, entry);
  
  // Clean up expired entries periodically
  if (_badgeCache.size > 50) { // Prevent cache from growing too large
    _cleanupExpiredCacheEntries();
  }
}

/**
 * Validates if a cache entry is still valid.
 * @private
 * @param {Object} entry - Cache entry to validate
 * @returns {boolean} Whether the entry is valid
 */
function _isCacheEntryValid(entry) {
  return entry && entry.expires > Date.now();
}

/**
 * Cleans up expired cache entries.
 * @private
 */
function _cleanupExpiredCacheEntries() {
  const now = Date.now();
  const toDelete = [];
  
  for (const [key, entry] of _badgeCache.entries()) {
    if (!_isCacheEntryValid(entry)) {
      toDelete.push(key);
    }
  }
  
  toDelete.forEach(key => _badgeCache.delete(key));
  
  if (toDelete.length > 0) {
    console.log(`[BadgeManager] Cleaned up ${toDelete.length} expired cache entries`);
  }
}

/**
 * Safe wrapper for setting badge text with error handling.
 * @private
 * @param {number} tabId - The tab ID to update
 * @param {string} text - The badge text to display
 */
async function _setBadgeTextSafely(tabId, text) {
  try {
    const result = await safeBrowserApiCall(
      () => browser.action.setBadgeText({ text, tabId }),
      [],
      'Set badge text'
    );
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    // Set badge background color for better visibility
    if (text) {
      await safeBrowserApiCall(
        () => browser.action.setBadgeBackgroundColor({
          color: [0, 122, 255, 255], // Blue background
          tabId: tabId
        }),
        [],
        'Set badge background color'
      );
    }
  } catch (error) {
    const categorized = categorizeError(error);
    console.error('[BadgeManager] Error setting badge text:', {
      tabId,
      text,
      error: categorized.userMessage,
      type: categorized.type
    });
    
    // Don't retry badge setting errors as they're usually not recoverable
  }
}

/**
 * Calculates and updates badge text for the given tab.
 * Enhanced with debouncing and error handling.
 * @async
 * @function updateBadgeForTab
 * @param {number} tabId - The ID of the tab to update
 * @param {string} url - The URL of the tab
 * @returns {Promise<void>}
 */
export async function updateBadgeForTab(tabId, url) {
  // Use the enhanced debounced update function
  await _debouncedBadgeUpdate(tabId, url);
}

/**
 * Handles tab activation changes and updates badge accordingly.
 * @async
 * @function handleTabActivation
 * @param {Object} activeInfo - Information about the activated tab
 * @param {number} activeInfo.tabId - The ID of the activated tab
 * @returns {Promise<void>}
 */
export async function handleTabActivation(activeInfo) {
  if (!activeInfo || !activeInfo.tabId) {
    return;
  }
  
  try {
    // Get tab information
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('moz-extension://')) {
      // Clear badge for internal pages
      await _setBadgeText(activeInfo.tabId, "");
      return;
    }
    
    // Update current tab info
    _currentTabInfo = {
      tabId: activeInfo.tabId,
      url: tab.url,
      siteId: null
    };
    
    // Update badge with debouncing
    if (_debounceState.timer) {
      clearTimeout(_debounceState.timer);
    }
    
    _debounceState.timer = setTimeout(() => {
      updateBadgeForTab(activeInfo.tabId, tab.url);
    }, 100);
    
  } catch (error) {
    console.error('[BadgeManager] Error handling tab activation:', error);
  }
}

/**
 * Handles tab updates (e.g., URL changes) and updates badge accordingly.
 * @async
 * @function handleTabUpdate
 * @param {number} tabId - The ID of the updated tab
 * @param {Object} changeInfo - Information about what changed
 * @param {Object} tab - The updated tab object
 * @returns {Promise<void>}
 */
export async function handleTabUpdate(tabId, changeInfo, tab) {
  // Only update badge when URL changes and tab is active
  if (!changeInfo.url || !tab.active) {
    return;
  }
  
  try {
    // Update current tab info if this is the active tab
    if (tab.active) {
      _currentTabInfo = {
        tabId: tabId,
        url: tab.url,
        siteId: null
      };
    }
    
    // Update badge with debouncing
    if (_debounceState.timer) {
      clearTimeout(_debounceState.timer);
    }
    
    _debounceState.timer = setTimeout(() => {
      updateBadgeForTab(tabId, tab.url);
    }, 100);
    
  } catch (error) {
    console.error('[BadgeManager] Error handling tab update:', error);
  }
}

/**
 * Refreshes badge text for the currently active tab.
 * Should be called when usage statistics are updated.
 * @async
 * @function refreshCurrentTabBadge
 * @returns {Promise<void>}
 */
export async function refreshCurrentTabBadge() {
  if (!_currentTabInfo.tabId || !_currentTabInfo.url) {
    return;
  }
  
  // Clear cache to force recalculation
  _badgeCache.clear();
  
  // Update badge for current tab
  await updateBadgeForTab(_currentTabInfo.tabId, _currentTabInfo.url);
}

/**
 * Clears all badge text and resets cache.
 * @async
 * @function clearAllBadges
 * @returns {Promise<void>}
 */
export async function clearAllBadges() {
  try {
    _badgeCache.clear();
    
    // Clear badge text for all tabs
    const tabs = await browser.tabs.query({});
    const clearPromises = tabs.map(tab => 
      _setBadgeText(tab.id, "").catch(error => 
        console.warn(`[BadgeManager] Could not clear badge for tab ${tab.id}:`, error)
      )
    );
    
    await Promise.allSettled(clearPromises);
    
  } catch (error) {
    console.error('[BadgeManager] Error clearing all badges:', error);
  }
}

/**
 * Initializes the badge manager by setting up event listeners.
 * @async
 * @function initializeBadgeManager
 * @returns {Promise<void>}
 */
export async function initializeBadgeManager() {
  try {
    console.log('[BadgeManager] Initializing badge manager...');
    
    // Set up tab event listeners
    browser.tabs.onActivated.addListener(handleTabActivation);
    browser.tabs.onUpdated.addListener(handleTabUpdate);
    
    // Set initial badge for current active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].url) {
      _currentTabInfo = {
        tabId: tabs[0].id,
        url: tabs[0].url,
        siteId: null
      };
      await updateBadgeForTab(tabs[0].id, tabs[0].url);
    }
    
    console.log('[BadgeManager] Badge manager initialized successfully');
    
  } catch (error) {
    console.error('[BadgeManager] Error initializing badge manager:', error);
  }
} 