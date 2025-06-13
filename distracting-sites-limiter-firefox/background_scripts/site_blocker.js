/**
 * @file site_blocker.js
 * @description Manages the blocking of distracting sites when their daily time limit is exceeded.
 * Works in conjunction with the usage_storage and site_storage modules to determine when to block.
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
 * Checks if a site should be blocked based on its daily time limit and current usage.
 * @param {string} tabId - The ID of the tab to check.
 * @param {string} url - The URL to check.
 * @returns {Promise<{shouldBlock: boolean, siteId: string|null, reason: string|null}>} Object containing:
 *   - shouldBlock: Whether the site should be blocked
 *   - siteId: The ID of the matched distracting site, if any
 *   - reason: A human-readable reason for blocking, if shouldBlock is true
 */
export async function checkAndBlockSite(tabId, url) {
  if (!tabId || !url) {
    console.warn('[SiteBlocker] Invalid parameters provided to checkAndBlockSite:', { tabId, url });
    return { shouldBlock: false, siteId: null, reason: null };
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
      return { shouldBlock: false, siteId: null, reason: null };
    }

    // Get today's usage stats
    const dateString = _getCurrentDateString();
    const dailyStats = await getUsageStats(dateString);
    const siteStats = dailyStats[matchingSite.id] || { timeSpentSeconds: 0, opens: 0 };

    // Check if time limit is exceeded
    if (siteStats.timeSpentSeconds >= matchingSite.dailyLimitSeconds) {
      const timeSpentMinutes = Math.round(siteStats.timeSpentSeconds / 60);
      const limitMinutes = Math.round(matchingSite.dailyLimitSeconds / 60);
      return {
        shouldBlock: true,
        siteId: matchingSite.id,
        reason: `You've spent ${timeSpentMinutes} minutes on this site today, exceeding your ${limitMinutes} minute limit.`
      };
    }

    return { shouldBlock: false, siteId: matchingSite.id, reason: null };
  } catch (error) {
    console.error('[SiteBlocker] Error checking site block status:', error);
    // On error, don't block to avoid accidentally restricting access
    return { shouldBlock: false, siteId: null, reason: null };
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
    const { shouldBlock, siteId, reason } = await checkAndBlockSite(tabId, url);
    
    if (shouldBlock && siteId) {
      const timeoutUrl = browser.runtime.getURL('ui/timeout/timeout.html');
      const redirectUrl = new URL(timeoutUrl);
      redirectUrl.searchParams.set('blockedUrl', url);
      redirectUrl.searchParams.set('siteId', siteId);
      redirectUrl.searchParams.set('reason', reason || '');

      await browser.tabs.update(tabId, { url: redirectUrl.toString() });
      console.log(`[SiteBlocker] Redirected tab ${tabId} to timeout page for site ${siteId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[SiteBlocker] Error during redirection:', error);
    return false;
  }
} 