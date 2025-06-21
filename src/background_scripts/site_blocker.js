/**
 * @file site_blocker.js
 * @description Manages the blocking of distracting sites when their daily time or open count limits are exceeded.
 * Works in conjunction with the usage_storage and site_storage modules to determine when to block.
 * Updated to support both time limits and open count limits.
 * 
 * This module is now event-driven and called directly from background.js navigation events.
 * It operates statelessly, retrieving all necessary data from chrome.storage on each call.
 */

import { getDistractingSites } from './site_storage.js';
import { getUsageStats } from './usage_storage.js';

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
 * Generates a human-readable reason for blocking based on which limits were exceeded.
 * @private
 * @param {Object} site - The site configuration
 * @param {Object} siteStats - The current usage statistics
 * @param {boolean} timeExceeded - Whether time limit was exceeded
 * @param {boolean} opensExceeded - Whether open limit was exceeded
 * @returns {string} Human-readable blocking reason
 */
function _generateBlockingReason(site, siteStats, timeExceeded, opensExceeded) {
  const timeSpentMinutes = Math.round(siteStats.timeSpentSeconds / 60);
  const limitMinutes = Math.round(site.dailyLimitSeconds / 60);
  
  if (timeExceeded && opensExceeded) {
    return `You've exceeded both your time limit (${timeSpentMinutes}/${limitMinutes} minutes) and open limit (${siteStats.opens}/${site.dailyOpenLimit} opens) for this site today.`;
  } else if (timeExceeded) {
    return `You've spent ${timeSpentMinutes} minutes on this site today, exceeding your ${limitMinutes} minute limit.`;
  } else if (opensExceeded) {
    return `You've opened this site ${siteStats.opens} times today, exceeding your ${site.dailyOpenLimit} open limit.`;
  }
  
  return "Daily limit exceeded for this site.";
}

/**
 * Checks if a site should be blocked based on its daily limits and current usage.
 * Now supports both time limits and open count limits.
 * This function is stateless and suitable for event-driven architecture.
 * 
 * @param {string|number} tabId - The ID of the tab to check (from navigation event)
 * @param {string} url - The URL to check (from navigation event)
 * @returns {Promise<{shouldBlock: boolean, siteId: string|null, reason: string|null, limitType: string|null}>} Object containing:
 *   - shouldBlock: Whether the site should be blocked
 *   - siteId: The ID of the matched distracting site, if any
 *   - reason: A human-readable reason for blocking, if shouldBlock is true
 *   - limitType: The type of limit that was exceeded ('time', 'opens', or 'both')
 */
export async function checkAndBlockSite(tabId, url) {
  // Enhanced validation for navigation event parameters
  if (!tabId || !url || typeof url !== 'string') {
    console.warn('[SiteBlocker] Invalid parameters provided to checkAndBlockSite:', { tabId, url });
    return { shouldBlock: false, siteId: null, reason: null, limitType: null };
  }

  console.log(`[SiteBlocker] Checking if site should be blocked: ${url}`);

  try {
    // Get all distracting sites
    const distractingSites = await getDistractingSites();
    console.log(`[SiteBlocker] Retrieved ${distractingSites.length} distracting sites from storage`);
    
    // Find a matching site that is enabled
    const matchingSite = distractingSites.find(site => {
      if (!site.isEnabled) {
        console.log(`[SiteBlocker] Skipping disabled site: ${site.urlPattern}`);
        return false;
      }
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        // FIXED: Check if hostname contains the pattern, not the other way around
        const isMatch = hostname.includes(site.urlPattern);
        console.log(`[SiteBlocker] Checking pattern '${site.urlPattern}' against hostname '${hostname}': ${isMatch ? 'MATCH' : 'no match'}`);
        return isMatch;
      } catch (error) {
        console.warn(`[SiteBlocker] Error parsing URL '${url}':`, error.message);
        return false;
      }
    });

    if (!matchingSite) {
      console.log(`[SiteBlocker] No matching distracting site found for ${url}`);
      return { shouldBlock: false, siteId: null, reason: null, limitType: null };
    }

    console.log(`[SiteBlocker] Found matching site: ${matchingSite.urlPattern} (ID: ${matchingSite.id})`);

    // Get today's usage stats
    const dateString = _getCurrentDateString();
    console.log(`[SiteBlocker] Getting usage stats for date: ${dateString}`);
    const dailyStats = await getUsageStats(dateString);
    const siteStats = dailyStats[matchingSite.id] || { timeSpentSeconds: 0, opens: 0 };
    
    console.log(`[SiteBlocker] Current usage for site ${matchingSite.id}:`, {
      timeSpentSeconds: siteStats.timeSpentSeconds,
      opens: siteStats.opens,
      timeSpentMinutes: Math.round(siteStats.timeSpentSeconds / 60)
    });
    
    console.log(`[SiteBlocker] Site limits:`, {
      dailyLimitSeconds: matchingSite.dailyLimitSeconds,
      dailyLimitMinutes: Math.round(matchingSite.dailyLimitSeconds / 60),
      dailyOpenLimit: matchingSite.dailyOpenLimit
    });

    // Check both time and open limits
    const hasTimeLimit = matchingSite.dailyLimitSeconds > 0;
    const hasOpenLimit = matchingSite.dailyOpenLimit > 0;
    
    const timeExceeded = hasTimeLimit && siteStats.timeSpentSeconds >= matchingSite.dailyLimitSeconds;
    const opensExceeded = hasOpenLimit && siteStats.opens >= matchingSite.dailyOpenLimit;

    console.log(`[SiteBlocker] Limit check results:`, {
      hasTimeLimit,
      hasOpenLimit,
      timeExceeded,
      opensExceeded
    });

    // Block if any limit is exceeded
    if (timeExceeded || opensExceeded) {
      let limitType = 'unknown';
      if (timeExceeded && opensExceeded) {
        limitType = 'both';
      } else if (timeExceeded) {
        limitType = 'time';
      } else if (opensExceeded) {
        limitType = 'opens';
      }
      
      const reason = _generateBlockingReason(matchingSite, siteStats, timeExceeded, opensExceeded);
      
      console.log(`[SiteBlocker] BLOCKING site ${matchingSite.id} due to ${limitType} limit. Reason: ${reason}`);
      
      return {
        shouldBlock: true,
        siteId: matchingSite.id,
        reason: reason,
        limitType: limitType
      };
    }

    console.log(`[SiteBlocker] Site ${matchingSite.id} is within limits, allowing access`);
    return { shouldBlock: false, siteId: matchingSite.id, reason: null, limitType: null };
  } catch (error) {
    console.error('[SiteBlocker] Error checking site block status:', error);
    // On error, don't block to avoid accidentally restricting access
    return { shouldBlock: false, siteId: null, reason: null, limitType: null };
  }
}

/**
 * Checks if opening a site would exceed the open count limit (before actually opening).
 * This is used to prevent opening sites that would immediately exceed the open limit.
 * @param {string} url - The URL to check.
 * @returns {Promise<{wouldExceed: boolean, siteId: string|null, currentOpens: number, limit: number}>} Object containing:
 *   - wouldExceed: Whether opening this site would exceed the open limit
 *   - siteId: The ID of the matched distracting site, if any
 *   - currentOpens: Current number of opens for the site
 *   - limit: The open limit for the site
 */
export async function checkOpenLimitBeforeAccess(url) {
  if (!url) {
    return { wouldExceed: false, siteId: null, currentOpens: 0, limit: 0 };
  }

  try {
    // Get all distracting sites
    const distractingSites = await getDistractingSites();
    
    // Find a matching site that is enabled and has an open limit
    const matchingSite = distractingSites.find(site => {
      if (!site.isEnabled || !site.dailyOpenLimit) return false;
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes(site.urlPattern);
      } catch (error) {
        console.warn(`[SiteBlocker] Error parsing URL '${url}':`, error.message);
        return false;
      }
    });

    if (!matchingSite) {
      return { wouldExceed: false, siteId: null, currentOpens: 0, limit: 0 };
    }

    // Get today's usage stats
    const dateString = _getCurrentDateString();
    const dailyStats = await getUsageStats(dateString);
    const siteStats = dailyStats[matchingSite.id] || { timeSpentSeconds: 0, opens: 0 };

    // Check if we would exceed the open limit with one more open
    const wouldExceed = (siteStats.opens + 1) > matchingSite.dailyOpenLimit;

    return {
      wouldExceed: wouldExceed,
      siteId: matchingSite.id,
      currentOpens: siteStats.opens,
      limit: matchingSite.dailyOpenLimit
    };
  } catch (error) {
    console.error('[SiteBlocker] Error checking open limit before access:', error);
    return { wouldExceed: false, siteId: null, currentOpens: 0, limit: 0 };
  }
}

/**
 * Redirects a tab to the timeout page if the site should be blocked.
 * This is the main entry point called by the event-driven background script.
 * It checks blocking status and performs redirection if necessary.
 * 
 * @param {string|number} tabId - The ID of the tab to potentially redirect (from navigation event)
 * @param {string} url - The URL being accessed (from navigation event)
 * @returns {Promise<boolean>} Whether the tab was redirected
 */
export async function handlePotentialRedirect(tabId, url) {
  console.log(`[SiteBlocker] handlePotentialRedirect called for tab ${tabId}, URL: ${url}`);
  
  try {
    const { shouldBlock, siteId, reason, limitType } = await checkAndBlockSite(tabId, url);
    
    if (shouldBlock && siteId) {
      console.log(`[SiteBlocker] Redirecting tab ${tabId} to timeout page. Reason: ${reason}`);
      
      // Construct timeout page URL with query parameters
      const timeoutUrl = browser.runtime.getURL('ui/timeout/timeout.html') + 
                        `?blockedUrl=${encodeURIComponent(url)}&siteId=${encodeURIComponent(siteId)}&reason=${encodeURIComponent(reason)}&limitType=${encodeURIComponent(limitType)}`;
      
      // Perform the redirect
      await browser.tabs.update(tabId, { url: timeoutUrl });
      console.log(`[SiteBlocker] Successfully redirected tab ${tabId} to timeout page`);
      return true;
    }
    
    console.log(`[SiteBlocker] No redirection needed for tab ${tabId}`);
    return false;
  } catch (error) {
    console.error(`[SiteBlocker] Error in handlePotentialRedirect for tab ${tabId}:`, error);
    return false;
  }
} 