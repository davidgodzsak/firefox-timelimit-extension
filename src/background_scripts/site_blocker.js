/**
 * @file site_blocker.js
 * @description Manages the blocking of distracting sites when their daily time or open count limits are exceeded.
 * Works in conjunction with the usage_storage and site_storage modules to determine when to block.
 * Updated to support both time limits and open count limits.
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
 * @param {string} tabId - The ID of the tab to check.
 * @param {string} url - The URL to check.
 * @returns {Promise<{shouldBlock: boolean, siteId: string|null, reason: string|null, limitType: string|null}>} Object containing:
 *   - shouldBlock: Whether the site should be blocked
 *   - siteId: The ID of the matched distracting site, if any
 *   - reason: A human-readable reason for blocking, if shouldBlock is true
 *   - limitType: The type of limit that was exceeded ('time', 'opens', or 'both')
 */
export async function checkAndBlockSite(tabId, url) {
  if (!tabId || !url) {
    console.warn('[SiteBlocker] Invalid parameters provided to checkAndBlockSite:', { tabId, url });
    return { shouldBlock: false, siteId: null, reason: null, limitType: null };
  }

  try {
    // Get all distracting sites
    const distractingSites = await getDistractingSites();
    
    // Find a matching site that is enabled
    const matchingSite = distractingSites.find(site => {
      if (!site.isEnabled) return false;
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes(site.urlPattern);
      } catch (error) {
        console.warn(`[SiteBlocker] Error parsing URL '${url}':`, error.message);
        return false;
      }
    });

    if (!matchingSite) {
      return { shouldBlock: false, siteId: null, reason: null, limitType: null };
    }

    // Get today's usage stats
    const dateString = _getCurrentDateString();
    const dailyStats = await getUsageStats(dateString);
    const siteStats = dailyStats[matchingSite.id] || { timeSpentSeconds: 0, opens: 0 };

    // Check both time and open limits
    const hasTimeLimit = matchingSite.dailyLimitSeconds > 0;
    const hasOpenLimit = matchingSite.dailyOpenLimit > 0;
    
    const timeExceeded = hasTimeLimit && siteStats.timeSpentSeconds >= matchingSite.dailyLimitSeconds;
    const opensExceeded = hasOpenLimit && siteStats.opens >= matchingSite.dailyOpenLimit;

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
      
      return {
        shouldBlock: true,
        siteId: matchingSite.id,
        reason: reason,
        limitType: limitType
      };
    }

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
 * @param {string} tabId - The ID of the tab to potentially redirect.
 * @param {string} url - The URL being accessed.
 * @returns {Promise<boolean>} Whether the tab was redirected.
 */
export async function handlePotentialRedirect(tabId, url) {
  try {
    const { shouldBlock, siteId, reason, limitType } = await checkAndBlockSite(tabId, url);
    
    if (shouldBlock && siteId) {
      const timeoutUrl = browser.runtime.getURL('ui/timeout/timeout.html');
      const redirectUrl = new URL(timeoutUrl);
      redirectUrl.searchParams.set('blockedUrl', url);
      redirectUrl.searchParams.set('siteId', siteId);
      redirectUrl.searchParams.set('reason', reason || '');
      redirectUrl.searchParams.set('limitType', limitType || 'unknown');

      await browser.tabs.update(tabId, { url: redirectUrl.toString() });
      console.log(`[SiteBlocker] Redirected tab ${tabId} to timeout page for site ${siteId} (${limitType} limit exceeded)`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[SiteBlocker] Error during redirection:', error);
    return false;
  }
} 