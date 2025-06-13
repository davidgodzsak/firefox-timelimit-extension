/**
 * @file usage_recorder.js
 * @description Handles the recording of time spent and open counts for distracting sites.
 * It manages timers for periodic updates and interacts with storage to persist usage data.
 */

const TRACKING_RESOLUTION_MS = 5000; // How often to record time spent, in milliseconds.

let _currentTrackingState = {
  siteId: null,       // ID of the site currently being tracked
  startTime: null,    // Timestamp (ms) when tracking for the current slice started
  intervalId: null,   // ID for the setInterval timer for periodic updates
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
 * Updates usage statistics in storage for a given site.
 * Assumes `getUsageStats` and `updateUsageStats` are available from `storage_manager.js`.
 * @private
 * @param {string} siteId - The ID of the distracting site.
 * @param {number} timeIncrementSeconds - The amount of time (in seconds) to add. Can be 0.
 * @param {boolean} [isNewOpen=false] - Whether to increment the open count for the site.
 */
async function _updateUsageStatsInStorage(siteId, timeIncrementSeconds, isNewOpen = false) {
  if (!siteId) {
    console.warn('[UsageRecorder] Attempted to update usage stats with no siteId.');
    return;
  }
  const dateString = _getCurrentDateString();
  let siteStats = { timeSpentSeconds: 0, opens: 0 };

  try {
    // Try to get existing stats, but continue with defaults if it fails
    try {
      const dailyStats = await getUsageStats(dateString) || {};
      siteStats = dailyStats[siteId] || siteStats;
    } catch (error) {
      console.error(`[UsageRecorder] Error reading usage stats for site ${siteId} on ${dateString}:`, error);
      // Continue with default stats
    }

    // Update the stats
    siteStats.timeSpentSeconds += Math.round(timeIncrementSeconds);
    if (isNewOpen) {
      siteStats.opens += 1;
    }

    console.log(`[UsageRecorder] Updating usage: Date: ${dateString}, Site: ${siteId}, Spent: ${siteStats.timeSpentSeconds}s, Opens: ${siteStats.opens}`);
    await updateUsageStats(dateString, siteId, siteStats);
  } catch (error) {
    console.error(`[UsageRecorder] Error updating usage stats for site ${siteId} on ${dateString}:`, error);
  }
}

/**
 * Records the currently accumulated time slice for the active distracting site.
 * This is called periodically by the timer.
 * @private
 */
async function _recordCurrentTimeSlice() {
  if (_currentTrackingState.siteId && _currentTrackingState.startTime) {
    const elapsedMs = Date.now() - _currentTrackingState.startTime;
    if (elapsedMs > 0) {
      await _updateUsageStatsInStorage(_currentTrackingState.siteId, elapsedMs / 1000, false);
    }
    // Reset start time for the next interval, continuing tracking the same siteId.
    _currentTrackingState.startTime = Date.now();
  } else {
    // This case should ideally not be hit if a timer is active, but good for safety.
    console.warn('[UsageRecorder] _recordCurrentTimeSlice called without active tracking state.');
    await stopTrackingSiteTime(); // Stop timer if it's somehow running without state
  }
}

/**
 * Initializes the usage recorder module.
 * Currently, this is a placeholder for any future setup, but the module is mostly reactive.
 */
export function initializeUsageRecorder() {
  console.log('[UsageRecorder] Initialized.');
  // Any future one-time setup for the recorder can go here.
}

/**
 * Starts tracking time for a specific distracting site.
 * If already tracking a site, it will stop the previous and start the new one.
 * @param {string} siteId - The ID of the distracting site to start tracking.
 */
export async function startTrackingSiteTime(siteId) {
  if (!siteId) {
    console.warn('[UsageRecorder] Attempted to start tracking without a siteId.');
    return;
  }

  // If currently tracking something else, or even the same site (to reset timer logic), stop it first.
  if (_currentTrackingState.intervalId) {
    await stopTrackingSiteTime();
  }

  _currentTrackingState.siteId = siteId;
  _currentTrackingState.startTime = Date.now(); // Set start time for the new tracking period

  if (!_currentTrackingState.intervalId) {
    _currentTrackingState.intervalId = setInterval(_recordCurrentTimeSlice, TRACKING_RESOLUTION_MS);
    console.log(`[UsageRecorder] Started periodic time recording for site: ${siteId}.`);
  }
}

/**
 * Stops tracking time for the currently active site.
 * Records any final accumulated time before stopping.
 */
export async function stopTrackingSiteTime() {
  if (_currentTrackingState.intervalId) {
    clearInterval(_currentTrackingState.intervalId);
    _currentTrackingState.intervalId = null;
    console.log(`[UsageRecorder] Stopped periodic time recording for site: ${_currentTrackingState.siteId}.`);
  }

  // Record any final time slice if tracking was active for a site.
  if (_currentTrackingState.siteId && _currentTrackingState.startTime) {
    const elapsedMs = Date.now() - _currentTrackingState.startTime;
    if (elapsedMs > 0) {
      console.log(`[UsageRecorder] Recording final time slice of ${elapsedMs / 1000}s for site ${_currentTrackingState.siteId}.`);
      await _updateUsageStatsInStorage(_currentTrackingState.siteId, elapsedMs / 1000, false);
    }
  }
  
  // Reset tracking state
  _currentTrackingState.siteId = null;
  _currentTrackingState.startTime = null;
}

/**
 * Records an "open" event for a distracting site.
 * @param {string} siteId - The ID of the distracting site that was opened.
 */
export async function recordSiteOpen(siteId) {
  if (!siteId) {
    console.warn('[UsageRecorder] Attempted to record site open without a siteId.');
    return;
  }
  console.log(`[UsageRecorder] Recording site open for: ${siteId}`);
  await _updateUsageStatsInStorage(siteId, 0, true); // 0 time, but increment open count
}

// Assume functions will be callable by time_tracker.js orchestrator. 