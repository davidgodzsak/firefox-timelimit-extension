/**
 * @file usage_recorder.js
 * @description Handles the recording of time spent and open counts for distracting sites.
 * This module is now stateless and event-driven, using browser.storage.local for
 * tracking state with session-like behavior. Compatible with Manifest V3 Firefox.
 */

import { getUsageStats, updateUsageStats } from './usage_storage.js';

// Session storage keys for tracking state - using local storage with session prefix
const SESSION_KEYS = {
  SITE_ID: 'session_tracking_siteId',
  START_TIME: 'session_tracking_startTime',
  TAB_ID: 'session_tracking_tabId',
  IS_ACTIVE: 'session_tracking_isActive',
  INIT_TIME: 'session_init_time', // Used to detect extension restarts
};

// Initialize session tracking on module load
let _initPromise = null;

/**
 * Initializes the session tracking system and cleans up any stale data
 * @private
 */
async function _initializeSession() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const currentTime = Date.now();
      const result = await browser.storage.local.get([SESSION_KEYS.INIT_TIME]);
      const lastInitTime = result[SESSION_KEYS.INIT_TIME];

      // If this is a fresh start or extension was restarted, clear old session data
      if (!lastInitTime || currentTime - lastInitTime > 60000) {
        // 1 minute threshold
        console.log('[UsageRecorder] Cleaning up stale session data');
        await _clearTrackingState();
      }

      // Set new init time
      await browser.storage.local.set({
        [SESSION_KEYS.INIT_TIME]: currentTime,
      });
      console.log('[UsageRecorder] Session initialized');
    } catch (error) {
      console.error('[UsageRecorder] Error initializing session:', error);
    }
  })();

  return _initPromise;
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
 * Updates usage statistics in storage for a given site.
 * @private
 * @param {string} siteId - The ID of the distracting site.
 * @param {number} timeIncrementSeconds - The amount of time (in seconds) to add. Can be 0.
 * @param {boolean} [isNewOpen=false] - Whether to increment the open count for the site.
 */
async function _updateUsageStatsInStorage(
  siteId,
  timeIncrementSeconds,
  isNewOpen = false
) {
  if (!siteId) {
    console.warn(
      '[UsageRecorder] Attempted to update usage stats with no siteId.'
    );
    return;
  }

  const dateString = _getCurrentDateString();
  let siteStats = { timeSpentSeconds: 0, opens: 0 };

  try {
    // Try to get existing stats, but continue with defaults if it fails
    try {
      const dailyStats = (await getUsageStats(dateString)) || {};
      siteStats = dailyStats[siteId] || siteStats;
    } catch (error) {
      console.error(
        `[UsageRecorder] Error reading usage stats for site ${siteId} on ${dateString}:`,
        error
      );
      // Continue with default stats
    }

    // Update the stats
    siteStats.timeSpentSeconds += Math.round(timeIncrementSeconds);
    if (isNewOpen) {
      siteStats.opens += 1;
    }

    console.log(
      `[UsageRecorder] Updating usage: Date: ${dateString}, Site: ${siteId}, Spent: ${siteStats.timeSpentSeconds}s, Opens: ${siteStats.opens}`
    );
    await updateUsageStats(dateString, siteId, siteStats);

    return siteStats.timeSpentSeconds; // Return current total time for badge updates
  } catch (error) {
    console.error(
      `[UsageRecorder] Error updating usage stats for site ${siteId} on ${dateString}:`,
      error
    );
    throw error; // Re-throw error to be handled by caller
  }
}

/**
 * Gets the current tracking state from local storage.
 * @private
 * @returns {Promise<Object>} The tracking state object.
 */
async function _getTrackingState() {
  await _initializeSession();

  try {
    const result = await browser.storage.local.get([
      SESSION_KEYS.SITE_ID,
      SESSION_KEYS.START_TIME,
      SESSION_KEYS.TAB_ID,
      SESSION_KEYS.IS_ACTIVE,
    ]);

    return {
      siteId: result[SESSION_KEYS.SITE_ID] || null,
      startTime: result[SESSION_KEYS.START_TIME] || null,
      tabId: result[SESSION_KEYS.TAB_ID] || null,
      isActive: result[SESSION_KEYS.IS_ACTIVE] || false,
    };
  } catch (error) {
    console.error('[UsageRecorder] Error getting tracking state:', error);
    return { siteId: null, startTime: null, tabId: null, isActive: false };
  }
}

/**
 * Sets the tracking state in local storage.
 * @private
 * @param {Object} state - The state to set.
 */
async function _setTrackingState(state) {
  await _initializeSession();

  try {
    const storageData = {};
    if (state.siteId !== undefined)
      storageData[SESSION_KEYS.SITE_ID] = state.siteId;
    if (state.startTime !== undefined)
      storageData[SESSION_KEYS.START_TIME] = state.startTime;
    if (state.tabId !== undefined)
      storageData[SESSION_KEYS.TAB_ID] = state.tabId;
    if (state.isActive !== undefined)
      storageData[SESSION_KEYS.IS_ACTIVE] = state.isActive;

    await browser.storage.local.set(storageData);
  } catch (error) {
    console.error('[UsageRecorder] Error setting tracking state:', error);
    throw error; // Re-throw so callers can handle appropriately
  }
}

/**
 * Clears the tracking state from local storage.
 * @private
 */
async function _clearTrackingState() {
  try {
    await browser.storage.local.remove([
      SESSION_KEYS.SITE_ID,
      SESSION_KEYS.START_TIME,
      SESSION_KEYS.TAB_ID,
      SESSION_KEYS.IS_ACTIVE,
    ]);
  } catch (error) {
    console.warn(
      '[UsageRecorder] Error clearing tracking state (continuing):',
      error
    );
    // Don't throw - this is cleanup and should be non-blocking
  }
}

/**
 * Starts tracking time for a specific distracting site and tab.
 * Stores the tracking state in local storage for persistence across extension restarts.
 * @param {number} tabId - The ID of the tab where the distracting site is open.
 * @param {string} siteId - The ID of the distracting site to start tracking.
 * @returns {Promise<boolean>} True if tracking was started successfully, false otherwise.
 */
export async function startTracking(tabId, siteId) {
  console.log(
    `[UsageRecorder] startTracking called with tabId=${tabId}, siteId=${siteId}`
  );

  if (!tabId || !siteId) {
    console.warn(
      '[UsageRecorder] Attempted to start tracking without valid tabId and siteId:',
      { tabId, siteId }
    );
    return false;
  }

  try {
    // If already tracking something, stop it first to record any accumulated time
    const currentState = await _getTrackingState();
    console.log('[UsageRecorder] Current tracking state:', currentState);

    if (currentState.isActive) {
      console.log(
        '[UsageRecorder] Stopping previous tracking before starting new session'
      );
      await stopTracking();
    }

    const startTime = Date.now();
    const newState = {
      siteId,
      startTime,
      tabId,
      isActive: true,
    };

    console.log('[UsageRecorder] Setting new tracking state:', newState);
    await _setTrackingState(newState);

    console.log(
      `[UsageRecorder] Started tracking site: ${siteId} in tab: ${tabId} at ${new Date(startTime).toISOString()}`
    );

    // Record the site open event
    console.log(
      `[UsageRecorder] Recording site open event for site: ${siteId}`
    );
    await _updateUsageStatsInStorage(siteId, 0, true);

    // Verify the state was set correctly
    const verifyState = await _getTrackingState();
    console.log(
      '[UsageRecorder] Verified tracking state after start:',
      verifyState
    );

    return true;
  } catch (error) {
    console.error('[UsageRecorder] Error starting tracking:', error);
    return false;
  }
}

/**
 * Stops tracking time for the currently active site.
 * Records any final accumulated time and clears the tracking state.
 * @returns {Promise<number>} The total time spent on the site (in seconds) or 0 if no tracking was active.
 */
export async function stopTracking() {
  try {
    const state = await _getTrackingState();

    if (!state.isActive || !state.siteId || !state.startTime) {
      console.log('[UsageRecorder] No active tracking to stop');
      await _clearTrackingState(); // Clean up any partial state
      return 0;
    }

    // Calculate final time slice
    const elapsedMs = Date.now() - state.startTime;
    let totalTimeSeconds = 0;

    if (elapsedMs > 0) {
      console.log(
        `[UsageRecorder] Recording final time slice of ${elapsedMs / 1000}s for site ${state.siteId}`
      );
      try {
        totalTimeSeconds = await _updateUsageStatsInStorage(
          state.siteId,
          elapsedMs / 1000,
          false
        );
      } catch (updateError) {
        console.warn(
          '[UsageRecorder] Error updating final time slice, continuing with cleanup:',
          updateError
        );
        // Continue with cleanup even if update fails
      }
    }

    // Clear tracking state
    await _clearTrackingState();
    console.log(`[UsageRecorder] Stopped tracking site: ${state.siteId}`);

    return totalTimeSeconds;
  } catch (error) {
    console.error('[UsageRecorder] Error stopping tracking:', error);
    await _clearTrackingState(); // Ensure state is cleared even on error
    return 0;
  }
}

/**
 * Updates usage for the currently tracked site (called by alarm).
 * This function is called periodically to record incremental time slices
 * while maintaining the tracking session.
 * @returns {Promise<number>} The total time spent on the site (in seconds) or 0 if no tracking is active.
 */
export async function updateUsage() {
  console.log('[UsageRecorder] updateUsage called by alarm');

  try {
    const state = await _getTrackingState();
    console.log(
      '[UsageRecorder] Current tracking state in updateUsage:',
      state
    );

    if (!state.isActive || !state.siteId || !state.startTime) {
      console.log(
        '[UsageRecorder] updateUsage called but no active tracking found'
      );
      return 0;
    }

    // Calculate time since last update
    const now = Date.now();
    const elapsedMs = now - state.startTime;
    let totalTimeSeconds = 0;

    console.log(
      `[UsageRecorder] Time calculation: now=${now}, startTime=${state.startTime}, elapsed=${elapsedMs}ms (${elapsedMs / 1000}s)`
    );

    if (elapsedMs > 0) {
      console.log(
        `[UsageRecorder] Recording periodic time slice of ${elapsedMs / 1000}s for site ${state.siteId}`
      );
      try {
        totalTimeSeconds = await _updateUsageStatsInStorage(
          state.siteId,
          elapsedMs / 1000,
          false
        );
        console.log(
          `[UsageRecorder] Total time for site ${state.siteId} is now: ${totalTimeSeconds}s`
        );

        // Reset start time for next interval, continuing to track the same site
        try {
          const newStartTime = Date.now();
          await _setTrackingState({
            startTime: newStartTime,
          });
          console.log(
            `[UsageRecorder] Reset start time to: ${newStartTime} (${new Date(newStartTime).toISOString()})`
          );
        } catch (stateError) {
          console.warn(
            '[UsageRecorder] Error resetting start time, will continue tracking:',
            stateError
          );
          // Don't fail the entire operation if we can't update the start time
        }
      } catch (updateError) {
        console.warn(
          '[UsageRecorder] Error updating periodic time slice:',
          updateError
        );
        // Don't reset start time if update failed - will retry on next alarm
      }
    } else {
      console.warn(
        '[UsageRecorder] Elapsed time is 0 or negative, skipping update'
      );
    }

    return totalTimeSeconds;
  } catch (error) {
    console.error('[UsageRecorder] Error updating usage:', error);
    return 0;
  }
}

/**
 * Gets the current tracking information.
 * @returns {Promise<Object>} Object with current tracking state.
 */
export async function getCurrentTrackingInfo() {
  try {
    const state = await _getTrackingState();
    return {
      isTracking: state.isActive,
      siteId: state.siteId,
      tabId: state.tabId,
      startTime: state.startTime,
    };
  } catch (error) {
    console.error(
      '[UsageRecorder] Error getting current tracking info:',
      error
    );
    return { isTracking: false, siteId: null, tabId: null, startTime: null };
  }
}

/**
 * Records an "open" event for a distracting site without starting time tracking.
 * This is used when a site is opened but time tracking isn't started immediately.
 * @param {string} siteId - The ID of the distracting site that was opened.
 * @returns {Promise<boolean>} True if the open was recorded successfully, false otherwise.
 */
export async function recordSiteOpen(siteId) {
  if (!siteId) {
    console.warn(
      '[UsageRecorder] Attempted to record site open without a siteId.'
    );
    return false;
  }

  try {
    console.log(`[UsageRecorder] Recording site open for: ${siteId}`);
    const result = await _updateUsageStatsInStorage(siteId, 0, true); // 0 time, but increment open count
    return result !== undefined; // _updateUsageStatsInStorage returns time or 0, so check if it succeeded
  } catch (error) {
    console.error('[UsageRecorder] Error recording site open:', error);
    return false;
  }
}
