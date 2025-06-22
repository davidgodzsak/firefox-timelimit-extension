/**
 * @file badge_manager.js
 * @description Simplified badge manager for the event-driven architecture.
 * Provides a single updateBadge(tabId) function that fetches all necessary data
 * from chrome.storage and updates the badge text based on current usage and limits.
 * This module is stateless and designed for Manifest V3 compatibility.
 */

import { getDistractingSites } from './site_storage.js';
import { getUsageStats } from './usage_storage.js';
import {
  checkIfUrlIsDistracting,
  initializeDistractionDetector,
} from './distraction_detector.js';

// Ensure detector is initialized
let _detectorInitialized = false;

/**
 * Ensures the distraction detector is initialized
 * @private
 */
async function _ensureDetectorInitialized() {
  if (!_detectorInitialized) {
    try {
      await initializeDistractionDetector();
      _detectorInitialized = true;
      console.log(
        '[BadgeManager] Distraction detector initialized successfully'
      );
    } catch (error) {
      console.error(
        '[BadgeManager] Failed to initialize distraction detector:',
        error
      );
    }
  }
}

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
  if (remainingSeconds <= 0) return '0s';

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
  if (remainingOpens <= 0) return '0';
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
  if (!site || !site.isEnabled) return '';

  const siteUsage = usageStats[site.id] || { timeSpentSeconds: 0, opens: 0 };
  const parts = [];

  // Calculate remaining time if time limit is set
  if (site.dailyLimitSeconds > 0) {
    const remainingSeconds = Math.max(
      0,
      site.dailyLimitSeconds - siteUsage.timeSpentSeconds
    );
    if (remainingSeconds > 0) {
      parts.push(_formatRemainingTime(remainingSeconds));
    } else {
      parts.push('0s');
    }
  }

  // Calculate remaining opens if open limit is set
  if (site.dailyOpenLimit > 0) {
    const remainingOpens = Math.max(0, site.dailyOpenLimit - siteUsage.opens);
    if (remainingOpens > 0) {
      parts.push(_formatRemainingOpens(remainingOpens));
    } else {
      parts.push('0');
    }
  }

  // Join parts with a separator if both exist
  if (parts.length > 1) {
    return parts.join('/');
  } else if (parts.length === 1) {
    return parts[0];
  }

  return '';
}

/**
 * Checks if a URL is a distracting site using manual pattern matching
 * This is a fallback when the distraction detector is not available
 * @private
 * @param {string} url - The URL to check
 * @param {Array} sites - Array of distracting sites
 * @returns {Object} Object with isMatch and siteId properties
 */
function _manualDistractionCheck(url, sites) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    for (const site of sites) {
      if (
        site.isEnabled &&
        site.urlPattern &&
        hostname.includes(site.urlPattern)
      ) {
        console.log(
          `[BadgeManager] Manual match found: ${hostname} contains ${site.urlPattern} (site ID: ${site.id})`
        );
        return { isMatch: true, siteId: site.id };
      }
    }

    return { isMatch: false, siteId: null };
  } catch (error) {
    console.warn('[BadgeManager] Error in manual distraction check:', error);
    return { isMatch: false, siteId: null };
  }
}

/**
 * Sets the badge text and background color for a specific tab.
 * @private
 * @param {number} tabId - The tab ID to update
 * @param {string} text - The badge text to display
 */
async function _setBadgeText(tabId, text) {
  try {
    await browser.action.setBadgeText({
      text: text,
      tabId: tabId,
    });

    // Set badge background color for better visibility
    if (text) {
      await browser.action.setBadgeBackgroundColor({
        color: [0, 122, 255, 255], // Blue background
        tabId: tabId,
      });
    }
  } catch (error) {
    console.error('[BadgeManager] Error setting badge text:', error);
  }
}

/**
 * Updates the badge for a specific tab by fetching current data from storage.
 * This is the main function that should be called from background.js.
 *
 * @async
 * @function updateBadge
 * @param {number} tabId - The ID of the tab to update the badge for
 * @returns {Promise<void>}
 */
export async function updateBadge(tabId) {
  console.log(`[BadgeManager] updateBadge called for tab ${tabId}`);

  if (!tabId) {
    console.warn(
      '[BadgeManager] Invalid tabId provided to updateBadge:',
      tabId
    );
    return;
  }

  try {
    // Ensure distraction detector is initialized
    await _ensureDetectorInitialized();

    // Get tab information
    const tab = await browser.tabs.get(tabId);
    if (!tab || !tab.url) {
      console.warn('[BadgeManager] Tab not found or has no URL:', tabId);
      return;
    }

    console.log(`[BadgeManager] Processing tab ${tabId} with URL: ${tab.url}`);

    // Skip internal pages
    if (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('moz-extension://') ||
      tab.url.startsWith('about:')
    ) {
      console.log(`[BadgeManager] Skipping internal page: ${tab.url}`);
      await _setBadgeText(tabId, '');
      return;
    }

    // Get sites data first for fallback checking
    const sites = await getDistractingSites();
    console.log(`[BadgeManager] Retrieved ${sites.length} sites from storage`);

    // Check if URL is a distracting site (with fallback)
    let distractionCheck = checkIfUrlIsDistracting(tab.url);
    console.log(
      `[BadgeManager] Primary distraction check result:`,
      distractionCheck
    );

    // If primary check failed due to initialization, use manual fallback
    if (!distractionCheck.isMatch && !distractionCheck.siteId) {
      console.log(
        `[BadgeManager] Primary check failed, trying manual fallback`
      );
      distractionCheck = _manualDistractionCheck(tab.url, sites);
      console.log(
        `[BadgeManager] Manual distraction check result:`,
        distractionCheck
      );
    }

    if (!distractionCheck.isMatch || !distractionCheck.siteId) {
      // Not a distracting site, clear badge
      console.log(
        `[BadgeManager] Not a distracting site, clearing badge for tab ${tabId}`
      );
      await _setBadgeText(tabId, '');
      return;
    }

    // Get usage data from storage
    console.log(
      `[BadgeManager] Fetching usage data for date: ${_getCurrentDateString()}`
    );
    const usageStats = await getUsageStats(_getCurrentDateString()).catch(
      (error) => {
        console.warn(
          '[BadgeManager] Failed to fetch usage stats, using empty data:',
          error
        );
        return {};
      }
    );

    console.log(`[BadgeManager] Retrieved usage stats:`, usageStats);

    // Find the specific site
    const site = sites.find((s) => s.id === distractionCheck.siteId);
    if (!site) {
      console.warn(
        '[BadgeManager] Site not found in storage:',
        distractionCheck.siteId
      );
      await _setBadgeText(tabId, '');
      return;
    }

    console.log(`[BadgeManager] Found site:`, {
      id: site.id,
      urlPattern: site.urlPattern,
      dailyLimitSeconds: site.dailyLimitSeconds,
      dailyOpenLimit: site.dailyOpenLimit,
      isEnabled: site.isEnabled,
    });

    // Calculate and set badge text
    const badgeText = _calculateBadgeText(site, usageStats);
    console.log(`[BadgeManager] Calculated badge text: "${badgeText}"`);

    await _setBadgeText(tabId, badgeText);

    console.log(
      `[BadgeManager] Successfully updated badge for tab ${tabId}: "${badgeText}"`
    );
  } catch (error) {
    console.error('[BadgeManager] Error in updateBadge:', error);
    // Clear badge on error to avoid showing stale data
    try {
      await _setBadgeText(tabId, '');
    } catch (clearError) {
      console.error(
        '[BadgeManager] Error clearing badge after failure:',
        clearError
      );
    }
  }
}

/**
 * Clears the badge text for a specific tab.
 * @async
 * @function clearBadge
 * @param {number} tabId - The ID of the tab to clear the badge for
 * @returns {Promise<void>}
 */
export async function clearBadge(tabId) {
  if (!tabId) {
    console.warn('[BadgeManager] Invalid tabId provided to clearBadge:', tabId);
    return;
  }

  try {
    await browser.action.setBadgeText({
      text: '',
      tabId: tabId,
    });
  } catch (error) {
    console.error('[BadgeManager] Error clearing badge:', error);
  }
}
