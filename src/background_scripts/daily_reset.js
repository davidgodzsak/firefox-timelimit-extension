/**
 * @file daily_reset.js
 * @description Manages the daily reset functionality for site usage statistics.
 * This module provides functions to initialize the daily reset alarm and perform
 * the actual reset operation. The alarm listener is now handled by background.js
 * as part of the event-driven architecture.
 */

import { getUsageStats } from './usage_storage.js';

// Name for the daily reset alarm - updated to match background.js
const DAILY_USAGE_RESET_ALARM_NAME = 'dailyResetAlarm';

/**
 * Calculates the timestamp for the next occurrence of midnight.
 * This is used to schedule the alarm's first run.
 *
 * @returns {number} The timestamp (milliseconds since epoch) for the next midnight.
 */
function getNextMidnight() {
  const now = new Date();
  // Create a date object for today, then advance to tomorrow
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  // Set time to 00:00:00 for the start of tomorrow
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

/**
 * Initializes the daily reset alarm.
 * This function creates a WebExtension alarm that is scheduled to fire at the next
 * midnight and then periodically every 24 hours.
 * It should be called once, typically from the background script on extension startup.
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If alarm creation fails
 */
export async function initializeDailyResetAlarm() {
  try {
    const nextRunTime = getNextMidnight();
    await browser.alarms.create(DAILY_USAGE_RESET_ALARM_NAME, {
      when: nextRunTime,
      periodInMinutes: 24 * 60, // Every 24 hours
    });

    // Confirm and log scheduled time
    const alarm = await browser.alarms.get(DAILY_USAGE_RESET_ALARM_NAME);
    if (alarm) {
      console.log(`[DailyReset] Alarm "${DAILY_USAGE_RESET_ALARM_NAME}" created/updated. Next scheduled run at: ${new Date(alarm.scheduledTime).toLocaleString()}`);
    } else {
      console.warn(`[DailyReset] Alarm "${DAILY_USAGE_RESET_ALARM_NAME}" was scheduled, but could not be retrieved immediately for logging its scheduled time. Intended first run was for: ${new Date(nextRunTime).toLocaleString()}`);
    }
  } catch (error) {
    console.error('[DailyReset] Error creating/updating daily reset alarm:', error);
    throw error;
  }
}

/**
 * Performs the daily reset of usage statistics.
 * This function clears all usage data that is older than the current day,
 * effectively resetting daily usage tracking. It preserves the current day's
 * data if any exists.
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If reset operation fails
 */
export async function performDailyReset() {
  const currentTime = new Date();
  const currentDateString = currentTime.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  console.log(`[DailyReset] Starting daily reset process at ${currentTime.toISOString()}`);
  
  try {
    // Get all storage keys to find usage statistics
    const allStorage = await browser.storage.local.get(null);
    const usageStatsKeys = Object.keys(allStorage).filter(key => key.startsWith('usageStats-'));
    
    // Identify keys that are not for today
    const keysToRemove = usageStatsKeys.filter(key => {
      const dateFromKey = key.replace('usageStats-', '');
      return dateFromKey !== currentDateString;
    });
    
    if (keysToRemove.length > 0) {
      console.log(`[DailyReset] Removing ${keysToRemove.length} old usage statistics entries:`, keysToRemove);
      await browser.storage.local.remove(keysToRemove);
    } else {
      console.log('[DailyReset] No old usage statistics found to remove');
    }
    
    // Verify current day's stats still exist (should be preserved)
    const currentDayStats = await getUsageStats(currentDateString);
    const sitesCount = Object.keys(currentDayStats).length;
    console.log(`[DailyReset] Current day (${currentDateString}) has ${sitesCount} site(s) with usage data - preserved`);
    
    console.log('[DailyReset] Daily reset completed successfully');
    
  } catch (error) {
    console.error('[DailyReset] Error during daily reset:', error);
    throw error;
  }
} 