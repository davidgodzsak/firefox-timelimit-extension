/**
 * @file badge_manager.js
 * @description Simplified badge manager for the event-driven architecture.
 * Provides a single updateBadge(tabId) function that fetches all necessary data
 * from chrome.storage and updates the badge text based on current usage and limits.
 * This module is stateless and designed for Manifest V3 compatibility.
 */

import { getDistractingSites } from './site_storage.js';
import { getUsageStats } from './usage_storage.js';
import { checkIfUrlIsDistracting } from './distraction_detector.js';

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
 * Sets the badge text and background color for a specific tab.
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
 * Updates the badge for a specific tab by fetching current data from storage.
 * This is the main function that should be called from background.js.
 * 
 * @async
 * @function updateBadge
 * @param {number} tabId - The ID of the tab to update the badge for
 * @returns {Promise<void>}
 */
export async function updateBadge(tabId) {
  if (!tabId) {
    console.warn('[BadgeManager] Invalid tabId provided to updateBadge:', tabId);
    return;
  }

  try {
    // Get tab information
    const tab = await browser.tabs.get(tabId);
    if (!tab || !tab.url) {
      console.warn('[BadgeManager] Tab not found or has no URL:', tabId);
      return;
    }

    // Skip internal pages
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('moz-extension://') || 
        tab.url.startsWith('about:')) {
      await _setBadgeText(tabId, "");
      return;
    }

    // Check if URL is a distracting site
    const distractionCheck = checkIfUrlIsDistracting(tab.url);
    if (!distractionCheck.isMatch || !distractionCheck.siteId) {
      // Not a distracting site, clear badge
      await _setBadgeText(tabId, "");
      return;
    }

    // Get sites and usage data from storage
    const [sitesResult, usageResult] = await Promise.allSettled([
      getDistractingSites(),
      getUsageStats(_getCurrentDateString())
    ]);

    // Handle errors in data fetching
    if (sitesResult.status === 'rejected' || !sitesResult.value.success) {
      console.error('[BadgeManager] Failed to fetch distracting sites:', sitesResult.reason);
      await _setBadgeText(tabId, "");
      return;
    }

    const sites = sitesResult.value.data || [];
    const usageStats = usageResult.status === 'fulfilled' && usageResult.value.success ? 
      usageResult.value.data : {};

    // Find the specific site
    const site = sites.find(s => s.id === distractionCheck.siteId);
    if (!site) {
      console.warn('[BadgeManager] Site not found in storage:', distractionCheck.siteId);
      await _setBadgeText(tabId, "");
      return;
    }

    // Calculate and set badge text
    const badgeText = _calculateBadgeText(site, usageStats);
    await _setBadgeText(tabId, badgeText);
    
    console.log(`[BadgeManager] Updated badge for tab ${tabId}: "${badgeText}"`);

  } catch (error) {
    console.error('[BadgeManager] Error in updateBadge:', error);
    // Clear badge on error to avoid showing stale data
    try {
      await _setBadgeText(tabId, "");
    } catch (clearError) {
      console.error('[BadgeManager] Error clearing badge after failure:', clearError);
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
      text: "",
      tabId: tabId
    });
  } catch (error) {
    console.error('[BadgeManager] Error clearing badge:', error);
  }
} 