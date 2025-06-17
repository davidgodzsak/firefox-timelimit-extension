/**
 * @file daily_reset.js
 * @description This script manages the daily reset alarm for site usage statistics.
 * It initializes an alarm that fires daily around midnight. When the alarm triggers,
 * it currently logs a message. The actual data reset logic will be handled by
 * other modules or integrated in later steps.
 * This module exports `initializeDailyResetAlarm` to be called by the main
 * background script, and it sets up the alarm listener upon load.
 */

// Name for the daily reset alarm
const DAILY_USAGE_RESET_ALARM_NAME = 'dailySiteUsageReset';

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
 * It should be called once, typically from the main background script.
 * Logs success or failure of alarm creation/update.
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
      // This case should ideally not be hit if browser.alarms.create was successful.
      console.warn(`[DailyReset] Alarm "${DAILY_USAGE_RESET_ALARM_NAME}" was scheduled, but could not be retrieved immediately for logging its scheduled time. Intended first run was for: ${new Date(nextRunTime).toLocaleString()}`);
    }
  } catch (error) {
    console.error('[DailyReset] Error creating/updating daily reset alarm:', error);
    // Consider further error handling or notification if critical
  }
}

/**
 * Handles the daily reset alarm when it triggers.
 * Currently, this function only logs that the alarm has fired, as per Step 2.1.
 * Future enhancements will integrate logic to reset daily usage statistics.
 *
 * @param {browser.alarms.Alarm} alarm - The alarm object that fired.
 */
function handleAlarm(alarm) {
  if (alarm.name === DAILY_USAGE_RESET_ALARM_NAME) {
    const currentTime = new Date();
    console.log(`[DailyReset] Alarm "${alarm.name}" triggered at ${currentTime.toISOString()}. Daily usage stats reset process would start here.`);
    // Future tasks for this handler (to be implemented in later steps):
    // 1. Determine the new current date string (e.g., "YYYY-MM-DD").
    // 2. Interact with storage_manager.js or time_tracker.js to clear or
    //    initialize usage statistics for the new day.
    // 3. Ensure this process is robust (e.g., handle potential errors during reset).
  }
}

// Add the listener for alarms.
// This needs to be registered when the background script loads to ensure it's active.
browser.alarms.onAlarm.addListener(handleAlarm);

// To make initializeDailyResetAlarm available to other modules (e.g., main.js)
// If using ES modules in background scripts (check manifest version and Firefox support):
// export { initializeDailyResetAlarm };

// If not using ES modules explicitly, functions become globally available to other
// background scripts loaded in the same context, or you might attach it to a global
// object if more explicit namespacing is needed.
// For now, assuming main.js will be able to call it.
// The plan (Step 2.9) is "Initialize/call main functions from daily_reset.js".
// This implies that `initializeDailyResetAlarm` should be callable.
// No explicit export needed if scripts are loaded in a shared global context (Manifest V2 style).
// For Manifest V3 with service workers, module imports/exports are standard.
// Assuming a context where `initializeDailyResetAlarm` will be callable from `main.js`. 