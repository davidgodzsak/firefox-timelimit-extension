/**
 * @file background.js
 * @description Event-driven background script for the Firefox Distraction Limiter extension.
 * This is the new entry point that replaces main.js with a Manifest V3 compatible
 * event-driven architecture. It acts as an event router, listening to browser events
 * and dispatching them to appropriate handler modules.
 *
 * QA FIX (Phase 4): Enhanced with comprehensive cache invalidation and immediate
 * re-evaluation system to ensure setting changes take effect immediately across all tabs.
 * Fixes issue where disabled/deleted limits didn't clear cache properly.
 *
 * Key responsibilities:
 * - Listen to browser.runtime.onInstalled to initialize alarms
 * - Listen to browser.alarms.onAlarm to handle scheduled tasks
 * - Listen to browser.webNavigation.onBeforeNavigate for proactive site blocking
 * - Listen to browser.runtime.onMessage for UI communication
 * - Listen to browser.action.onClicked for toolbar interaction
 * - Route events to appropriate modules (daily reset, usage tracking, site blocking, etc.)
 * - Maintain stateless architecture with chrome.storage as single source of truth
 * - [NEW] Immediate cache invalidation and tab re-evaluation on settings changes
 */

import { initializeDailyResetAlarm, performDailyReset } from './daily_reset.js';
import { handlePotentialRedirect, checkAndBlockSite } from './site_blocker.js';
import {
  startTracking,
  stopTracking,
  updateUsage,
  getCurrentTrackingInfo,
} from './usage_recorder.js';
import {
  checkIfUrlIsDistracting,
  initializeDistractionDetector,
  loadDistractingSitesFromStorage,
} from './distraction_detector.js';
import { updateBadge } from './badge_manager.js';

// Storage module imports for message handling
import {
  getDistractingSites,
  addDistractingSite,
  updateDistractingSite,
  deleteDistractingSite,
} from './site_storage.js';
import {
  getTimeoutNotes,
  addTimeoutNote,
  updateTimeoutNote,
  deleteTimeoutNote,
} from './note_storage.js';

// Enhanced validation and error handling utilities
import {
  categorizeError,
  validateRequiredFields,
  ERROR_TYPES,
} from './validation_utils.js';

/**
 * Handles the extension installation or startup.
 * Initializes necessary alarms and sets up the extension state.
 *
 * @param {Object} details - Installation details from browser.runtime.onInstalled
 * @param {string} details.reason - Reason for installation ('install', 'update', 'browser_update', etc.)
 */
async function handleInstalled(details) {
  console.log('[Background] Extension installed/started:', details.reason);

  try {
    // Initialize the daily reset alarm
    await initializeDailyResetAlarm();
    console.log('[Background] Daily reset alarm initialized successfully');

    // Initialize the distraction detector
    await initializeDistractionDetector();
    console.log('[Background] Distraction detector initialized successfully');
  } catch (error) {
    console.error('[Background] Error during initialization:', error);
  }
}

/**
 * Handles alarm events from the browser.alarms API.
 * Routes different alarm types to their appropriate handlers.
 *
 * @param {Object} alarm - The alarm object that fired
 * @param {string} alarm.name - The name of the alarm
 * @param {number} alarm.scheduledTime - When the alarm was scheduled to fire
 */
async function handleAlarm(alarm) {
  console.log(
    `[Background] Alarm "${alarm.name}" triggered at ${new Date(alarm.scheduledTime).toISOString()}`
  );

  try {
    switch (alarm.name) {
      case 'dailyResetAlarm':
        await performDailyReset();
        console.log('[Background] Daily reset completed successfully');
        break;

      case 'usageTimer': {
        // Update usage for currently tracked site
        const totalTimeSeconds = await updateUsage();
        console.log(
          `[Background] Usage updated via alarm. Total time: ${totalTimeSeconds}s`
        );

        // Update badge for current tracking info and broadcast usage update
        try {
          const trackingInfo = await getCurrentTrackingInfo();
          if (
            trackingInfo.isTracking &&
            trackingInfo.tabId &&
            trackingInfo.siteId
          ) {
            console.log(
              `[Background] Updating badge for tracked tab ${trackingInfo.tabId} after usage update`
            );
            await updateBadge(trackingInfo.tabId);

            // QA FIX: Check if current site should be blocked due to time limit being exceeded
            // This implements automatic timeout redirect when limits are reached
            try {
              const tab = await browser.tabs.get(trackingInfo.tabId);
              if (
                tab &&
                tab.url &&
                !tab.url.includes('ui/timeout/timeout.html')
              ) {
                console.log(
                  `[Background] Checking if current site should be blocked after usage update`
                );
                const wasRedirected = await handlePotentialRedirect(
                  trackingInfo.tabId,
                  tab.url
                );
                if (wasRedirected) {
                  console.log(
                    `[Background] Automatically redirected tab ${trackingInfo.tabId} to timeout page due to time limit`
                  );
                  // Stop tracking since we're redirecting to timeout page
                  await stopTracking();
                  await browser.alarms.clear('usageTimer');
                  return; // Exit early since we redirected
                }
              }
            } catch (error) {
              console.warn(
                '[Background] Error checking automatic timeout redirect:',
                error
              );
              // Continue with normal flow if redirect check fails
            }

            // Broadcast usage update to UI components
            await broadcastToUIComponents('usageUpdated', {
              siteId: trackingInfo.siteId,
              totalTimeSeconds: totalTimeSeconds,
              tabId: trackingInfo.tabId,
            });
          } else {
            console.log(
              `[Background] No active tracking found during alarm, skipping badge update`
            );
          }
        } catch (error) {
          console.warn(
            '[Background] Error updating badge after usage alarm:',
            error
          );
          // Continue without badge update - non-critical
        }
        break;
      }

      default:
        console.warn(`[Background] Unknown alarm: ${alarm.name}`);
        break;
    }
  } catch (error) {
    console.error(`[Background] Error handling alarm "${alarm.name}":`, error);
  }
}

/**
 * Handles navigation events before the navigation occurs.
 * This enables proactive site blocking before the page loads.
 * Only processes main frame navigations to avoid blocking iframes, ads, etc.
 * FIXED: Now properly updates usage before checking blocking to ensure accurate limit enforcement.
 *
 * @param {Object} details - Navigation details from browser.webNavigation.onBeforeNavigate
 * @param {number} details.tabId - The tab ID where navigation is occurring
 * @param {string} details.url - The URL being navigated to
 * @param {number} details.frameId - The frame ID (0 for main frame)
 * @param {string} details.transitionType - Type of navigation transition
 */
async function handleBeforeNavigate(details) {
  // Only process main frame navigations (frameId 0)
  // This avoids blocking iframes, ads, and other sub-resources
  if (details.frameId !== 0) {
    return;
  }

  const { tabId, url } = details;
  console.log(`[Background] Navigation detected: tab ${tabId} -> ${url}`);

  // Validate inputs
  if (!tabId || !url) {
    console.warn('[Background] Invalid navigation details:', { tabId, url });
    return;
  }

  try {
    // CRITICAL FIX: Update any active tracking before checking blocking
    // This ensures we have the most current usage data for limit checks
    const currentTrackingInfo = await getCurrentTrackingInfo();
    if (currentTrackingInfo.isTracking && currentTrackingInfo.tabId === tabId) {
      console.log(
        `[Background] Updating usage for current tracking before navigation blocking check`
      );
      await updateUsage();
    }

    // Check if the site should be blocked and redirect if necessary
    const wasRedirected = await handlePotentialRedirect(tabId, url);

    if (wasRedirected) {
      console.log(
        `[Background] Successfully blocked navigation to ${url} in tab ${tabId}`
      );
      // Stop any current tracking since we're redirecting to timeout page
      await stopTracking();
      try {
        await browser.alarms.clear('usageTimer');
        console.log('[Background] Cleared usage timer after blocking redirect');
      } catch (error) {
        console.warn(
          '[Background] Error clearing usage timer after blocking:',
          error
        );
      }
    }
  } catch (error) {
    console.error(
      '[Background] Error during navigation blocking check:',
      error
    );
    // Don't block navigation on error to avoid false positives
  }
}

/**
 * Handles tab activation events.
 * Starts or stops usage tracking based on whether the newly active tab is a distracting site.
 * @param {Object} activeInfo - Tab activation info from browser.tabs.onActivated
 * @param {number} activeInfo.tabId - The ID of the newly active tab
 */
async function handleTabActivated(activeInfo) {
  const { tabId } = activeInfo;
  console.log(`[Background] Tab activated: ${tabId}`);

  try {
    // Get the tab details
    const tab = await browser.tabs.get(tabId);
    await handleTabActivity(tabId, tab.url, true);

    // Update badge for the newly activated tab
    try {
      await updateBadge(tabId);
    } catch (error) {
      console.warn(
        '[Background] Error updating badge after tab activation:',
        error
      );
    }
  } catch (error) {
    console.error(
      `[Background] Error handling tab activation for tab ${tabId}:`,
      error
    );
  }
}

/**
 * Handles tab update events.
 * Monitors URL changes in the currently tracked tab or starts tracking new distracting sites.
 * @param {number} tabId - The ID of the updated tab
 * @param {Object} changeInfo - What changed about the tab
 * @param {Object} tab - The updated tab object
 */
async function handleTabUpdated(tabId, changeInfo, tab) {
  // Only respond to URL changes or page load completion
  if (!changeInfo.url && changeInfo.status !== 'complete') {
    return;
  }

  const newUrl = changeInfo.url || tab.url;
  if (!newUrl) {
    return;
  }

  console.log(`[Background] Tab updated: ${tabId} -> ${newUrl}`);

  try {
    // Check if this tab is currently active
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const isActiveTab = activeTab && activeTab.id === tabId;

    // Check if browser window is focused
    const currentWindow = await browser.windows.getCurrent();
    const isWindowFocused = currentWindow && currentWindow.focused;

    const shouldTrack = isActiveTab && isWindowFocused;
    await handleTabActivity(tabId, newUrl, shouldTrack);

    // Update badge when navigation is complete for active tab
    if (isActiveTab && changeInfo.status === 'complete') {
      try {
        await updateBadge(tabId);
      } catch (error) {
        console.warn(
          '[Background] Error updating badge after tab navigation complete:',
          error
        );
      }
    }
  } catch (error) {
    console.error(
      `[Background] Error handling tab update for tab ${tabId}:`,
      error
    );
  }
}

/**
 * Handles window focus change events.
 * @param {number} windowId - The ID of the focused window (-1 if no window is focused)
 */
async function handleWindowFocusChanged(windowId) {
  console.log(`[Background] Window focus changed: ${windowId}`);

  try {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      // No window focused, stop tracking
      await stopTracking();
      console.log('[Background] Stopped tracking due to window focus loss');
    } else {
      // Window focused, check if we should resume tracking
      const [activeTab] = await browser.tabs.query({
        active: true,
        windowId: windowId,
      });
      if (activeTab && activeTab.url) {
        await handleTabActivity(activeTab.id, activeTab.url, true);
      }
    }
  } catch (error) {
    console.error('[Background] Error handling window focus change:', error);
  }
}

/**
 * Core tab activity handler that determines whether to start or stop tracking.
 * FIXED: Now properly handles cases where user navigates within the same distracting site.
 * @param {number} tabId - The tab ID
 * @param {string} url - The tab URL
 * @param {boolean} shouldTrack - Whether tracking should be active
 */
async function handleTabActivity(tabId, url, shouldTrack) {
  console.log(
    `[Background] handleTabActivity: tab=${tabId}, url=${url}, shouldTrack=${shouldTrack}`
  );

  try {
    // Ensure distraction detector is initialized before checking
    try {
      await initializeDistractionDetector();
    } catch (initError) {
      console.warn(
        '[Background] Failed to initialize distraction detector:',
        initError
      );
    }

    // Check if URL is a distracting site
    const distractionCheck = checkIfUrlIsDistracting(url);
    const { isMatch, siteId } = distractionCheck;

    console.log(`[Background] Distraction check result:`, {
      isMatch,
      siteId,
      url,
    });

    if (!shouldTrack || !isMatch || !siteId) {
      // Stop tracking if we're not supposed to track or if it's not a distracting site
      console.log(
        '[Background] Stopping tracking (not shouldTrack or not distracting site)'
      );
      await stopTracking();
      // Clear any existing usage timer
      try {
        await browser.alarms.clear('usageTimer');
        console.log('[Background] Cleared usage timer alarm');
      } catch (error) {
        console.warn('[Background] Error clearing usage timer:', error);
      }

      // Update badge for the current tab (will clear it if not distracting)
      try {
        await updateBadge(tabId);
      } catch (error) {
        console.warn(
          '[Background] Error updating badge after stopping tracking:',
          error
        );
      }
      return;
    }

    console.log(`[Background] Detected distracting site: ${siteId} (${url})`);

    // FIXED: Check if we're already tracking the same site in the same tab
    const currentTrackingInfo = await getCurrentTrackingInfo();
    if (
      currentTrackingInfo.isTracking &&
      currentTrackingInfo.siteId === siteId &&
      currentTrackingInfo.tabId === tabId
    ) {
      console.log(
        `[Background] Already tracking site ${siteId} in tab ${tabId}, continuing existing session`
      );
      // Update badge but don't restart tracking
      try {
        await updateBadge(tabId);
      } catch (error) {
        console.warn(
          '[Background] Error updating badge for continued tracking:',
          error
        );
      }
      return;
    }

    // Start tracking for this site and tab
    const trackingStarted = await startTracking(tabId, siteId);
    console.log(`[Background] Tracking started: ${trackingStarted}`);

    if (trackingStarted) {
      // Create recurring alarm for usage updates
      try {
        // Clear any existing timer first to avoid duplicates
        await browser.alarms.clear('usageTimer');
        // QA FIX: Use 2-second intervals for real-time badge updates as per QA requirements
        // This provides responsive badge updates while maintaining good performance
        await browser.alarms.create('usageTimer', { periodInMinutes: 2 / 60 }); // 2 seconds (2/60 = 0.033 minutes)
        console.log(
          '[Background] Created usage timer alarm (2 second intervals)'
        );
      } catch (error) {
        console.warn('[Background] Error creating usage timer alarm:', error);
      }

      // Update badge for the current tab
      try {
        await updateBadge(tabId);
      } catch (error) {
        console.warn(
          '[Background] Error updating badge after starting tracking:',
          error
        );
      }
    }
  } catch (error) {
    console.error('[Background] Error in handleTabActivity:', error);
  }
}

/**
 * Handles incoming messages from UI components (settings page, timeout page, popup).
 * Provides an API for UI components to interact with the background script data and functionality.
 * Enhanced with better error categorization and validation.
 *
 * @param {Object} message - The message object sent from UI
 * @param {string} message.action - The action to perform
 * @param {Object} [message.payload] - Data associated with the action
 * @param {Object} _sender - Information about the message sender
 * @param {Function} _sendResponse - Function to send response back
 * @returns {Promise<any>|boolean} Response data or boolean indicating async response
 */
async function handleMessage(message, _sender, _sendResponse) {
  console.log(
    '[Background] Received message:',
    message.action,
    message.payload
  );

  // Validate basic message structure
  if (!message || typeof message !== 'object') {
    const errorResponse = {
      success: false,
      error: {
        message: 'Invalid message format',
        type: ERROR_TYPES.VALIDATION,
        isRetryable: false,
      },
    };
    console.error('[Background] Invalid message format:', message);
    return errorResponse;
  }

  if (!message.action || typeof message.action !== 'string') {
    const errorResponse = {
      success: false,
      error: {
        message: 'Message action is required',
        type: ERROR_TYPES.VALIDATION,
        isRetryable: false,
      },
    };
    console.error('[Background] Missing or invalid action:', message.action);
    return errorResponse;
  }

  try {
    switch (message.action) {
      // === Settings API ===
      case 'getAllSettings': {
        const [distractingSites, timeoutNotes] = await Promise.all([
          getDistractingSites(),
          getTimeoutNotes(),
        ]);
        return {
          success: true,
          data: { distractingSites, timeoutNotes },
          error: null,
        };
      }

      // === Distracting Sites Management ===
      case 'addDistractingSite': {
        const validation = validateRequiredFields(message.payload, [
          'urlPattern',
          'dailyLimitSeconds',
        ]);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField,
            },
          };
        }

        const newSite = await addDistractingSite(message.payload);
        if (!newSite) {
          return {
            success: false,
            error: {
              message:
                'Failed to add site. Please check the URL format and try again.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true,
            },
          };
        }

        // Reload distraction detector cache when sites change
        await _reloadDistractionDetectorCache();

        // Refresh badge for current tab since limits may have changed
        await _refreshCurrentTabBadge();

        // QA FIX: Re-evaluate ALL tabs for new site blocking status
        // A newly added site might now block currently open tabs
        try {
          await _reEvaluateAllTabsForSite(newSite, 'add');
        } catch (error) {
          console.warn(
            '[Background] Error re-evaluating all tabs after site addition:',
            error
          );
          // Don't fail the operation if re-evaluation fails
        }

        // Broadcast the update to all UI components
        await broadcastToUIComponents('siteAdded', { site: newSite });

        return {
          success: true,
          data: newSite,
          error: null,
        };
      }

      case 'updateDistractingSite': {
        const validation = validateRequiredFields(message.payload, [
          'id',
          'updates',
        ]);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField,
            },
          };
        }

        const updatedSite = await updateDistractingSite(
          message.payload.id,
          message.payload.updates
        );
        if (!updatedSite) {
          return {
            success: false,
            error: {
              message:
                'Failed to update site. Site may not exist or update data is invalid.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true,
            },
          };
        }

        await _reloadDistractionDetectorCache();

        // Refresh badge for current tab since limits may have changed
        await _refreshCurrentTabBadge();

        // Broadcast the update to all UI components
        await broadcastToUIComponents('siteUpdated', {
          site: updatedSite,
          updates: message.payload.updates,
        });

        // QA FIX: Re-evaluate ALL tabs for blocking status immediately after limit update
        // This ensures users can access sites immediately after updating limits in any tab
        try {
          await _reEvaluateAllTabsForSite(updatedSite, 'update');
        } catch (error) {
          console.warn(
            '[Background] Error re-evaluating all tabs after limit update:',
            error
          );
          // Don't fail the whole operation if re-evaluation fails
        }

        return {
          success: true,
          data: updatedSite,
          error: null,
        };
      }

      case 'deleteDistractingSite': {
        const validation = validateRequiredFields(message.payload, ['id']);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField,
            },
          };
        }

        const deleteResult = await deleteDistractingSite(message.payload.id);
        if (!deleteResult) {
          return {
            success: false,
            error: {
              message: 'Failed to delete site. Site may not exist.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true,
            },
          };
        }

        await _reloadDistractionDetectorCache();

        // Refresh badge for current tab since the site may have been removed
        await _refreshCurrentTabBadge();

        // QA FIX: Re-evaluate ALL tabs for blocking status immediately after site deletion
        // This ensures users can access sites immediately after removing limits from any tab
        try {
          // Use the deleted site's data for re-evaluation (pass the site that was just deleted)
          const deletedSiteData = { 
            id: message.payload.id, 
            urlPattern: '*', // We don't have the pattern anymore, so check all tabs
            isEnabled: false // Deleted sites are effectively disabled
          };
          await _reEvaluateAllTabsForSite(deletedSiteData, 'delete');
        } catch (error) {
          console.warn(
            '[Background] Error re-evaluating all tabs after site deletion:',
            error
          );
          // Don't fail the whole operation if re-evaluation fails
        }

        // Broadcast the update to all UI components
        await broadcastToUIComponents('siteDeleted', {
          siteId: message.payload.id,
        });

        return {
          success: true,
          data: { deleted: true, id: message.payload.id },
          error: null,
        };
      }

      // === Timeout Notes Management ===
      case 'addTimeoutNote': {
        const validation = validateRequiredFields(message.payload, ['text']);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField,
            },
          };
        }

        const newNote = await addTimeoutNote(message.payload);
        if (!newNote) {
          return {
            success: false,
            error: {
              message:
                'Failed to add note. Please check the note text and try again.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true,
            },
          };
        }

        return {
          success: true,
          data: newNote,
          error: null,
        };
      }

      case 'updateTimeoutNote': {
        const validation = validateRequiredFields(message.payload, [
          'id',
          'updates',
        ]);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField,
            },
          };
        }

        const updatedNote = await updateTimeoutNote(
          message.payload.id,
          message.payload.updates
        );
        if (!updatedNote) {
          return {
            success: false,
            error: {
              message:
                'Failed to update note. Note may not exist or update data is invalid.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true,
            },
          };
        }

        return {
          success: true,
          data: updatedNote,
          error: null,
        };
      }

      case 'deleteTimeoutNote': {
        const validation = validateRequiredFields(message.payload, ['id']);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField,
            },
          };
        }

        const deleteResult = await deleteTimeoutNote(message.payload.id);
        if (!deleteResult) {
          return {
            success: false,
            error: {
              message: 'Failed to delete note. Note may not exist.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true,
            },
          };
        }

        return {
          success: true,
          data: { deleted: true, id: message.payload.id },
          error: null,
        };
      }

      // === Timeout Page API ===
      case 'getTimeoutNotes': {
        const notes = await getTimeoutNotes();
        return {
          success: true,
          data: notes,
          error: null,
        };
      }

      case 'getRandomTimeoutNote': {
        const notes = await getTimeoutNotes();
        if (notes && notes.length > 0) {
          const randomIndex = Math.floor(Math.random() * notes.length);
          return {
            success: true,
            data: notes[randomIndex],
            error: null,
          };
        }
        return {
          success: true,
          data: null,
          error: null,
        };
      }

      case 'shuffleTimeoutNote': {
        const notes = await getTimeoutNotes();
        if (notes && notes.length > 0) {
          const randomIndex = Math.floor(Math.random() * notes.length);
          return {
            success: true,
            data: notes[randomIndex],
            error: null,
          };
        }
        return {
          success: true,
          data: { text: 'Stay focused and make the most of your time!' },
          error: null,
        };
      }

      // === Popup API ===
      case 'getCurrentPageLimitInfo': {
        try {
          // Get current active tab
          const tabs = await browser.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs.length === 0) {
            return {
              success: false,
              error: {
                message: 'No active tab found',
                type: ERROR_TYPES.SYSTEM,
                isRetryable: true,
              },
            };
          }

          const activeTab = tabs[0];
          if (!activeTab.url) {
            return {
              success: false,
              error: {
                message: 'Cannot access current tab URL',
                type: ERROR_TYPES.SYSTEM,
                isRetryable: true,
              },
            };
          }

          // Check if URL is a distracting site
          const distractionCheck = checkIfUrlIsDistracting(activeTab.url);
          const { isMatch, siteId } = distractionCheck;

          if (!isMatch || !siteId) {
            return {
              success: true,
              data: {
                url: activeTab.url,
                hostname: new URL(activeTab.url).hostname,
                isDistractingSite: false,
                siteInfo: null,
              },
              error: null,
            };
          }

          // Get site information and current usage data
          const [sites, { getUsageStats }] = await Promise.all([
            getDistractingSites(),
            import('./usage_storage.js'),
          ]);

          const site = sites.find((s) => s.id === siteId);

          if (!site) {
            return {
              success: true,
              data: {
                url: activeTab.url,
                hostname: new URL(activeTab.url).hostname,
                isDistractingSite: false,
                siteInfo: null,
              },
              error: null,
            };
          }

          // Get today's usage stats for accurate progress bars
          const today = new Date().toISOString().split('T')[0];
          const todayUsage = await getUsageStats(today);
          const siteUsage = todayUsage[siteId] || {
            timeSpentSeconds: 0,
            opens: 0,
          };

          // Enhanced site info with real usage data
          const enhancedSiteInfo = {
            ...site,
            todaySeconds: siteUsage.timeSpentSeconds,
            todayOpenCount: siteUsage.opens,
            lastUpdated: Date.now(),
          };

          return {
            success: true,
            data: {
              url: activeTab.url,
              hostname: new URL(activeTab.url).hostname,
              isDistractingSite: true,
              siteInfo: enhancedSiteInfo,
            },
            error: null,
          };
        } catch (error) {
          console.error(
            '[Background] Error getting current page limit info:',
            error
          );
          return {
            success: false,
            error: {
              message: 'Failed to get current page information',
              type: ERROR_TYPES.SYSTEM,
              isRetryable: true,
            },
          };
        }
      }

      // === Real-time Updates API ===
      case 'refreshCurrentPageData': {
        try {
          // Get current active tab
          const tabs = await browser.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs.length === 0) {
            return {
              success: false,
              error: {
                message: 'No active tab found',
                type: ERROR_TYPES.SYSTEM,
                isRetryable: true,
              },
            };
          }

          const activeTab = tabs[0];
          if (!activeTab.url) {
            return {
              success: false,
              error: {
                message: 'Cannot access current tab URL',
                type: ERROR_TYPES.SYSTEM,
                isRetryable: true,
              },
            };
          }

          // Check if URL is a distracting site
          const distractionCheck = checkIfUrlIsDistracting(activeTab.url);
          const { isMatch, siteId } = distractionCheck;

          if (!isMatch || !siteId) {
            return {
              success: true,
              data: {
                isDistractingSite: false,
                usage: null,
                badgeText: '',
              },
              error: null,
            };
          }

          // Get current usage data and site info
          const [sites, { getUsageStats }] = await Promise.all([
            getDistractingSites(),
            import('./usage_storage.js'),
          ]);

          const site = sites.find((s) => s.id === siteId);
          if (!site || !site.isEnabled) {
            return {
              success: true,
              data: {
                isDistractingSite: false,
                usage: null,
                badgeText: '',
              },
              error: null,
            };
          }

          // Get today's usage stats
          const today = new Date().toISOString().split('T')[0];
          const todayUsage = await getUsageStats(today);
          const siteUsage = todayUsage[siteId] || {
            timeSpentSeconds: 0,
            opens: 0,
          };

          // Update badge for current tab
          await updateBadge(activeTab.id);

          return {
            success: true,
            data: {
              isDistractingSite: true,
              usage: {
                timeSpentSeconds: siteUsage.timeSpentSeconds,
                opens: siteUsage.opens,
                lastUpdated: Date.now(),
              },
              site: site,
              badgeText: 'Updated by badge manager',
            },
            error: null,
          };
        } catch (error) {
          console.error(
            '[Background] Error refreshing current page data:',
            error
          );
          return {
            success: false,
            error: {
              message: 'Failed to refresh page data',
              type: ERROR_TYPES.SYSTEM,
              isRetryable: true,
            },
          };
        }
      }

      case 'addQuickLimit': {
        const validation = validateRequiredFields(message.payload, [
          'urlPattern',
          'dailyLimitSeconds',
        ]);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField,
            },
          };
        }

        const newSite = await addDistractingSite(message.payload);
        if (!newSite) {
          return {
            success: false,
            error: {
              message:
                'Failed to add site limit. Please check the URL format and try again.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true,
            },
          };
        }

        // Reload distraction detector cache when sites change
        await _reloadDistractionDetectorCache();

        // Refresh badge for current tab
        await _refreshCurrentTabBadge();

        // Broadcast the update to all UI components
        await broadcastToUIComponents('quickLimitAdded', { site: newSite });

        return {
          success: true,
          data: newSite,
          error: null,
        };
      }

      case 'getBadgeInfo': {
        const validation = validateRequiredFields(message.payload, ['url']);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField,
            },
          };
        }

        try {
          const { url } = message.payload;

          // Check if URL is a distracting site
          const distractionCheck = checkIfUrlIsDistracting(url);
          const { isMatch, siteId } = distractionCheck;

          if (!isMatch || !siteId) {
            return {
              success: true,
              data: {
                showBadge: false,
                badgeText: '',
                limitInfo: null,
              },
              error: null,
            };
          }

          // Get site and usage information
          const [sites, usageStatsModule] = await Promise.all([
            getDistractingSites(),
            import('./usage_storage.js'),
          ]);

          const usageStats = await usageStatsModule.getUsageStats(
            new Date().toISOString().split('T')[0]
          );

          const site = sites.find((s) => s.id === siteId);
          if (!site || !site.isEnabled) {
            return {
              success: true,
              data: {
                showBadge: false,
                badgeText: '',
                limitInfo: null,
              },
              error: null,
            };
          }

          const siteUsage = usageStats[siteId] || {
            timeSpentSeconds: 0,
            opens: 0,
          };

          return {
            success: true,
            data: {
              showBadge: true,
              badgeText: 'Will be calculated by badge manager',
              limitInfo: {
                site: site,
                usage: siteUsage,
              },
            },
            error: null,
          };
        } catch (error) {
          console.error('[Background] Error getting badge info:', error);
          return {
            success: false,
            error: {
              message: 'Failed to get badge information',
              type: ERROR_TYPES.SYSTEM,
              isRetryable: true,
            },
          };
        }
      }

      // === Debug/Status API ===
      case 'getSystemStatus': {
        try {
          const trackingInfo = await getCurrentTrackingInfo();
          const status = {
            isActive: trackingInfo.isTracking,
            currentlyTrackedSiteId: trackingInfo.siteId,
            currentTabId: trackingInfo.tabId,
            timestamp: Date.now(),
          };
          return {
            success: true,
            data: status,
            error: null,
          };
        } catch (error) {
          console.error('[Background] Error getting system status:', error);
          return {
            success: false,
            error: {
              message: 'Failed to get system status',
              type: ERROR_TYPES.SYSTEM,
              isRetryable: true,
            },
          };
        }
      }

      default:
        console.warn('[Background] Unknown message action:', message.action);
        return {
          success: false,
          error: {
            message: `Unknown action: ${message.action}`,
            type: ERROR_TYPES.VALIDATION,
            isRetryable: false,
          },
        };
    }
  } catch (error) {
    console.error('[Background] Error handling message:', error);

    const categorized = categorizeError(error);
    return {
      success: false,
      error: {
        message: categorized.userMessage,
        type: categorized.type,
        isRetryable: categorized.isRetryable,
        originalError: error.message,
      },
    };
  }
}

/**
 * Handles toolbar action button clicks.
 * The popup will open automatically due to manifest configuration,
 * but we can handle cases where popup is disabled or fails to open.
 * @param {Object} tab - The tab where the action was clicked
 */
async function handleActionClick(tab) {
  console.log('[Background] Toolbar action clicked for tab:', tab.id, tab.url);

  try {
    // If popup fails to open for any reason, we could implement fallback behavior here
    // For now, we just log the event since the popup should handle the interaction

    // Update badge for the current tab to ensure it's up to date
    if (tab.url && tab.id) {
      await updateBadge(tab.id);
    }
  } catch (actionError) {
    console.error('[Background] Error handling action click:', actionError);
  }
}

/**
 * Helper function to reload the distraction detector cache when sites change.
 * This ensures the detector always has up-to-date site information.
 * Enhanced with better error handling.
 * @private
 */
async function _reloadDistractionDetectorCache() {
  try {
    // The distraction detector has a method to reload from storage
    await loadDistractingSitesFromStorage();
    console.log(
      '[Background] Reloaded distraction detector cache after sites change'
    );
  } catch (error) {
    console.error(
      '[Background] Error reloading distraction detector cache:',
      error
    );
    // This is not critical for functionality, so we continue without throwing
  }
}

/**
 * Helper function to refresh the badge for the current active tab.
 * @private
 */
async function _refreshCurrentTabBadge() {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs.length > 0 && tabs[0].id) {
      await updateBadge(tabs[0].id);
    }
  } catch (error) {
    console.warn('[Background] Error refreshing current tab badge:', error);
    // Non-critical, continue without throwing
  }
}

/**
 * QA FIX: Re-evaluates all tabs for blocking status after site configuration changes.
 * This ensures immediate cache invalidation and proper blocking behavior across all tabs.
 * @private
 * @param {Object} siteData - The site data that was modified
 * @param {string} operation - The type of operation ('update', 'delete')
 */
async function _reEvaluateAllTabsForSite(siteData, operation) {
  try {
    console.log(`[Background] Re-evaluating all tabs after site ${operation}`);
    
    // Get all tabs
    const allTabs = await browser.tabs.query({});
    console.log(`[Background] Found ${allTabs.length} tabs to re-evaluate`);
    
    let notificationsShown = 0;
    const MAX_NOTIFICATIONS = 2; // Limit notifications to avoid spam
    
    for (const tab of allTabs) {
      if (!tab.url || !tab.id) continue;
      
      // Skip extension pages and special URLs
      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('moz-extension://') || 
          tab.url.startsWith('about:')) {
        continue;
      }
      
      try {
        // For deletions, we check if any site would block this tab
        // For updates, we check the specific site
        const blockResult = await checkAndBlockSite(tab.id, tab.url);
        
        console.log(`[Background] Tab ${tab.id} (${tab.url}) - Block result:`, {
          shouldBlock: blockResult.shouldBlock,
          siteId: blockResult.siteId,
          reason: blockResult.reason
        });
        
        // Update badge for this tab
        await updateBadge(tab.id);
        
        // Special handling for timeout pages
        if (tab.url.includes('ui/timeout/timeout.html')) {
          if (!blockResult.shouldBlock) {
            console.log(`[Background] Tab ${tab.id} no longer needs to be blocked`);
            
            // Show notification to user (limited to avoid spam)
            if (notificationsShown < MAX_NOTIFICATIONS) {
              try {
                await browser.notifications.create({
                  type: 'basic',
                  iconUrl: 'assets/icons/icon-48.png',
                  title: 'Site Limit Changed',
                  message: `You can now access this site. Go back or refresh the page.`
                });
                notificationsShown++;
              } catch (notificationError) {
                console.warn('[Background] Could not create notification:', notificationError);
              }
            }
          }
        }
        
      } catch (tabError) {
        console.warn(`[Background] Error re-evaluating tab ${tab.id}:`, tabError);
        // Continue with other tabs even if one fails
      }
    }
    
    console.log(`[Background] Completed re-evaluation of all tabs. Notifications shown: ${notificationsShown}`);
    
  } catch (error) {
    console.error('[Background] Error in _reEvaluateAllTabsForSite:', error);
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Broadcasts updates to all extension UI components for real-time synchronization
 * @param {string} type - The type of update ('siteUpdated', 'siteDeleted', 'usageUpdated', etc.)
 * @param {Object} data - The data associated with the update
 */
async function broadcastToUIComponents(type, data) {
  try {
    // Create the broadcast message
    const message = {
      type: 'broadcastUpdate',
      updateType: type,
      data: data,
      timestamp: Date.now(),
    };

    console.log(`[Background] Broadcasting update: ${type}`, data);

    // Try to send to popup (if open)
    try {
      await browser.runtime.sendMessage(message);
    } catch {
      // Popup probably not open, which is fine
      console.log(
        '[Background] Popup not available for broadcast (expected if closed)'
      );
    }

    // Get all extension pages (settings, timeout) and send message
    try {
      const views = browser.extension.getViews();
      views.forEach((view) => {
        if (
          view.location.href.includes('/settings/') ||
          view.location.href.includes('/timeout/')
        ) {
          try {
            view.postMessage(message, '*');
          } catch (error) {
            console.warn('[Background] Error posting message to view:', error);
          }
        }
      });
    } catch (error) {
      console.warn('[Background] Error getting extension views:', error);
    }
  } catch (error) {
    console.warn('[Background] Error broadcasting update:', error);
    // Don't fail the main operation if broadcast fails
  }
}

// === Event Listener Registration ===

// Set up all event listeners
try {
  // Extension lifecycle events
  browser.runtime.onInstalled.addListener(handleInstalled);
  console.log('[Background] runtime.onInstalled listener registered');

  // Alarm events
  browser.alarms.onAlarm.addListener(handleAlarm);
  console.log('[Background] alarms.onAlarm listener registered');

  // Navigation events
  browser.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
  console.log(
    '[Background] webNavigation.onBeforeNavigate listener registered'
  );

  // Tab events
  browser.tabs.onActivated.addListener(handleTabActivated);
  browser.tabs.onUpdated.addListener(handleTabUpdated);
  console.log('[Background] tab event listeners registered');

  // Window events
  browser.windows.onFocusChanged.addListener(handleWindowFocusChanged);
  console.log('[Background] windows.onFocusChanged listener registered');

  // Message events for UI communication
  browser.runtime.onMessage.addListener(handleMessage);
  console.log('[Background] runtime.onMessage listener registered');

  // Action button events
  browser.action.onClicked.addListener(handleActionClick);
  console.log('[Background] action.onClicked listener registered');

  console.log('[Background] All event listeners registered successfully');
} catch (listenerError) {
  console.error('[Background] Error registering event listeners:', listenerError);
}

console.log(
  '[Background] Firefox Distraction Limiter background script loaded'
);
