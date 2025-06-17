/**
 * @file usage_storage.js
 * @description Manages CRUD operations for usage statistics in browser.storage.local.
 */

/**
 * Retrieves usage statistics for a specific date from storage.
 * The date string is used to form a unique key for daily stats.
 *
 * @async
 * @function getUsageStats
 * @param {string} dateString - The date for which to retrieve stats, in "YYYY-MM-DD" format.
 * @returns {Promise<Object>} A promise that resolves to an object containing usage statistics for the given date.
 *                            Returns an empty object if no stats are found for that date or an error occurs.
 */
export async function getUsageStats(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    console.error("Error: dateString parameter is required and must be a string for getUsageStats.");
    return {};
  }
  const key = `usageStats-${dateString}`;
  try {
    const result = await browser.storage.local.get(key);
    return result[key] || {};
  } catch (error) {
    console.error(`Error getting usage stats for date ${dateString}:`, error);
    return {};
  }
}

/**
 * Updates (or creates) usage data for a specific site on a specific date.
 *
 * @async
 * @function updateUsageStats
 * @param {string} dateString - The date for which to update stats, in "YYYY-MM-DD" format.
 * @param {string} siteId - The ID of the site to update usage for.
 * @param {Object} usageData - An object containing the usage data to set.
 * @param {number} usageData.timeSpentSeconds - The total time spent in seconds.
 * @param {number} usageData.opens - The total number of opens.
 * @returns {Promise<boolean>} A promise that resolves to true on success, false on failure.
 */
export async function updateUsageStats(dateString, siteId, usageData) {
    if (!dateString || typeof dateString !== 'string') {
        console.error("Invalid dateString provided to updateUsageStats.");
        return false;
    }
    if (!siteId || typeof siteId !== 'string') {
        console.error("Invalid siteId provided to updateUsageStats.");
        return false;
    }
    if (!usageData || typeof usageData.timeSpentSeconds !== 'number' || typeof usageData.opens !== 'number') {
        console.error("Invalid usageData provided to updateUsageStats.", usageData);
        return false;
    }

    const key = `usageStats-${dateString}`;
    try {
        const dailyStats = await getUsageStats(dateString);
        dailyStats[siteId] = usageData;
        await browser.storage.local.set({ [key]: dailyStats });
        return true;
    } catch (error) {
        console.error(`Error updating usage stats for site ${siteId} on date ${dateString}:`, error);
        return false;
    }
} 