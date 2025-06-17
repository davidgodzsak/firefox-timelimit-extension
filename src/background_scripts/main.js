/**
 * @file main.js
 * @description Main background script orchestrator for the Firefox Distraction Limiter extension.
 * This is the central entry point that initializes all background modules and coordinates
 * their interactions. It handles:
 * - Daily reset alarm initialization
 * - Tab activity monitoring and distraction detection
 * - Time tracking and usage recording
 * - Site blocking when limits are exceeded
 * - Message passing with UI components (settings, timeout, and popup pages)
 * - Toolbar badge management and action handling
 * 
 * Architecture:
 * - Tab Activity Monitor: Detects tab changes and browser focus
 * - Distraction Detector: Checks if URLs match distracting sites
 * - Usage Recorder: Tracks time spent and opens for distracting sites  
 * - Site Blocker: Enforces limits by redirecting to timeout page
 * - Badge Manager: Updates toolbar badge with remaining limits
 * - Daily Reset: Resets usage statistics daily
 * - Storage Modules: Handle data persistence
 */

// Import all required modules
import { initializeDailyResetAlarm } from './daily_reset.js';
import { initializeDistractionDetector, checkIfUrlIsDistracting } from './distraction_detector.js';
import { initializeTabActivityMonitor } from './tab_activity_monitor.js';
import { 
  initializeUsageRecorder, 
  startTrackingSiteTime, 
  stopTrackingSiteTime, 
  recordSiteOpen 
} from './usage_recorder.js';
import { handlePotentialRedirect } from './site_blocker.js';
import { 
  initializeBadgeManager, 
  updateBadgeForTab, 
  refreshCurrentTabBadge 
} from './badge_manager.js';

// Storage module imports for message handling
import { getDistractingSites, addDistractingSite, updateDistractingSite, deleteDistractingSite } from './site_storage.js';
import { getTimeoutNotes, addTimeoutNote, updateTimeoutNote, deleteTimeoutNote } from './note_storage.js';

// Enhanced validation and error handling utilities
import { 
  categorizeError, 
  validateRequiredFields, 
  ERROR_TYPES 
} from './validation_utils.js';

/**
 * Current tracking state for orchestration
 * @private
 */
let _orchestrationState = {
  currentlyTrackedSiteId: null,  // The site ID currently being tracked for time
  lastActiveUrl: null,           // Last known active URL to detect changes
  isSystemActive: false,         // Whether the browser window is focused and active
};

/**
 * Handles changes in browser tab activity from the Tab Activity Monitor.
 * This is the core orchestration function that coordinates distraction detection,
 * usage recording, and site blocking based on user activity.
 * 
 * @param {Object} activityInfo - Activity information from tab monitor
 * @param {number|null} activityInfo.tabId - Active tab ID
 * @param {string|null} activityInfo.url - Active tab URL  
 * @param {boolean} activityInfo.isFocused - Whether browser window is focused
 */
async function handleTabActivityChange(activityInfo) {
  const { tabId, url, isFocused } = activityInfo;
  
  console.log('[Main] Tab activity change:', { tabId, url, isFocused });
  
  // Update system active state
  const wasSystemActive = _orchestrationState.isSystemActive;
  _orchestrationState.isSystemActive = isFocused && tabId && url;
  
  // If system became inactive, stop any ongoing tracking
  if (wasSystemActive && !_orchestrationState.isSystemActive) {
    console.log('[Main] System became inactive, stopping time tracking');
    await stopTrackingSiteTime();
    _orchestrationState.currentlyTrackedSiteId = null;
    _orchestrationState.lastActiveUrl = null;
    return;
  }
  
  // If system is not active, don't process further
  if (!_orchestrationState.isSystemActive) {
    return;
  }
  
  // Check if URL changed (including first activation)
  const urlChanged = _orchestrationState.lastActiveUrl !== url;
  _orchestrationState.lastActiveUrl = url;
  
  if (urlChanged && url) {
    // Check if the new URL is a distracting site
    const distractionCheck = checkIfUrlIsDistracting(url);
    const { isMatch, siteId } = distractionCheck;
    
    // Stop tracking previous site if we were tracking one
    if (_orchestrationState.currentlyTrackedSiteId) {
      console.log(`[Main] Stopping tracking for previous site: ${_orchestrationState.currentlyTrackedSiteId}`);
      await stopTrackingSiteTime();
      _orchestrationState.currentlyTrackedSiteId = null;
      
      // Refresh badge after stopping tracking (usage may have updated)
      await refreshCurrentTabBadge();
    }
    
    if (isMatch && siteId) {
      console.log(`[Main] Detected distracting site: ${siteId} (${url})`);
      
      // First, check if site should be blocked before we start tracking
      try {
        const wasRedirected = await handlePotentialRedirect(tabId, url);
        
        if (!wasRedirected) {
          // Site was not blocked, so we can start tracking
          console.log(`[Main] Starting time tracking for site: ${siteId}`);
          
          // Record that the site was opened
          await recordSiteOpen(siteId);
          
          // Start tracking time for this site
          await startTrackingSiteTime(siteId);
          _orchestrationState.currentlyTrackedSiteId = siteId;
          
          // Refresh badge after recording open (usage updated)
          await refreshCurrentTabBadge();
        } else {
          console.log(`[Main] Site ${siteId} was blocked and redirected`);
        }
      } catch (error) {
        console.error('[Main] Error during site blocking check:', error);
        // If blocking check fails, still start tracking to avoid data loss
        await recordSiteOpen(siteId);
        await startTrackingSiteTime(siteId);
        _orchestrationState.currentlyTrackedSiteId = siteId;
        
        // Refresh badge even on error
        await refreshCurrentTabBadge();
      }
    } else {
      console.log('[Main] Non-distracting site, no tracking needed');
    }
  }
  
  // If URL didn't change but focus state changed for a distracting site
  else if (!urlChanged && _orchestrationState.currentlyTrackedSiteId) {
    if (_orchestrationState.isSystemActive) {
      // Resume tracking if we weren't already
      console.log(`[Main] Resuming tracking for site: ${_orchestrationState.currentlyTrackedSiteId}`);
      await startTrackingSiteTime(_orchestrationState.currentlyTrackedSiteId);
    }
  }
}

/**
 * Handles incoming messages from UI components (settings page, timeout page).
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
  console.log('[Main] Received message:', message.action, message.payload);
  
  // Validate basic message structure
  if (!message || typeof message !== 'object') {
    const errorResponse = {
      success: false,
      error: {
        message: 'Invalid message format',
        type: ERROR_TYPES.VALIDATION,
        isRetryable: false
      }
    };
    console.error('[Main] Invalid message format:', message);
    return errorResponse;
  }

  if (!message.action || typeof message.action !== 'string') {
    const errorResponse = {
      success: false,
      error: {
        message: 'Message action is required',
        type: ERROR_TYPES.VALIDATION,
        isRetryable: false
      }
    };
    console.error('[Main] Missing or invalid action:', message.action);
    return errorResponse;
  }
  
  try {
    switch (message.action) {
      // === Settings API ===
      case 'getAllSettings': {
        const [distractingSites, timeoutNotes] = await Promise.all([
          getDistractingSites(),
          getTimeoutNotes()
        ]);
        return { 
          success: true, 
          data: { distractingSites, timeoutNotes },
          error: null
        };
      }
      
      // === Distracting Sites Management ===
      case 'addDistractingSite': {
        const validation = validateRequiredFields(message.payload, ['urlPattern', 'dailyLimitSeconds']);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField
            }
          };
        }
        
        const newSite = await addDistractingSite(message.payload);
        if (!newSite) {
          return {
            success: false,
            error: {
              message: 'Failed to add site. Please check the URL format and try again.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true
            }
          };
        }
        
        // Reload distraction detector cache when sites change
        await _reloadDistractionDetectorCache();
        
        // Refresh badge for current tab since limits may have changed
        await refreshCurrentTabBadge();
        
        return { 
          success: true, 
          data: newSite,
          error: null
        };
      }
      
      case 'updateDistractingSite': {
        const validation = validateRequiredFields(message.payload, ['id', 'updates']);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField
            }
          };
        }
        
        const updatedSite = await updateDistractingSite(message.payload.id, message.payload.updates);
        if (!updatedSite) {
          return {
            success: false,
            error: {
              message: 'Failed to update site. Site may not exist or update data is invalid.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true
            }
          };
        }
        
        await _reloadDistractionDetectorCache();
        
        // Refresh badge for current tab since limits may have changed
        await refreshCurrentTabBadge();
        
        return { 
          success: true, 
          data: updatedSite,
          error: null
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
              field: validation.missingField
            }
          };
        }
        
        const deleteResult = await deleteDistractingSite(message.payload.id);
        if (!deleteResult) {
          return {
            success: false,
            error: {
              message: 'Failed to delete site. Site may not exist.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true
            }
          };
        }
        
        await _reloadDistractionDetectorCache();
        
        // Refresh badge for current tab since the site may have been removed
        await refreshCurrentTabBadge();
        
        return { 
          success: true, 
          data: { deleted: true, id: message.payload.id },
          error: null
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
              field: validation.missingField
            }
          };
        }
        
        const newNote = await addTimeoutNote(message.payload);
        if (!newNote) {
          return {
            success: false,
            error: {
              message: 'Failed to add note. Please check the note text and try again.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true
            }
          };
        }
        
        return { 
          success: true, 
          data: newNote,
          error: null
        };
      }
      
      case 'updateTimeoutNote': {
        const validation = validateRequiredFields(message.payload, ['id', 'updates']);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField
            }
          };
        }
        
        const updatedNote = await updateTimeoutNote(message.payload.id, message.payload.updates);
        if (!updatedNote) {
          return {
            success: false,
            error: {
              message: 'Failed to update note. Note may not exist or update data is invalid.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true
            }
          };
        }
        
        return { 
          success: true, 
          data: updatedNote,
          error: null
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
              field: validation.missingField
            }
          };
        }
        
        const deleteResult = await deleteTimeoutNote(message.payload.id);
        if (!deleteResult) {
          return {
            success: false,
            error: {
              message: 'Failed to delete note. Note may not exist.',
              type: ERROR_TYPES.STORAGE,  
              isRetryable: true
            }
          };
        }
        
        return { 
          success: true, 
          data: { deleted: true, id: message.payload.id },
          error: null
        };
      }
      
      // === Timeout Page API ===
      case 'getTimeoutNotes': {
        const notes = await getTimeoutNotes();
        return { 
          success: true, 
          data: notes,
          error: null
        };
      }
      
      case 'getRandomTimeoutNote': {
        const notes = await getTimeoutNotes();
        if (notes && notes.length > 0) {
          const randomIndex = Math.floor(Math.random() * notes.length);
          return { 
            success: true, 
            data: notes[randomIndex],
            error: null
          };
        }
        return { 
          success: true, 
          data: null,
          error: null
        };
      }

      case 'shuffleTimeoutNote': {
        const notes = await getTimeoutNotes();
        if (notes && notes.length > 0) {
          const randomIndex = Math.floor(Math.random() * notes.length);
          return { 
            success: true, 
            data: notes[randomIndex],
            error: null
          };
        }
        return { 
          success: true, 
          data: { text: "Stay focused and make the most of your time!" },
          error: null
        };
      }
      
      // === Popup API ===
      case 'getCurrentPageLimitInfo': {
        try {
          // Get current active tab
          const tabs = await browser.tabs.query({ active: true, currentWindow: true });
          if (tabs.length === 0) {
            return {
              success: false,
              error: {
                message: 'No active tab found',
                type: ERROR_TYPES.SYSTEM,
                isRetryable: true
              }
            };
          }
          
          const activeTab = tabs[0];
          if (!activeTab.url) {
            return {
              success: false,
              error: {
                message: 'Cannot access current tab URL',
                type: ERROR_TYPES.SYSTEM,
                isRetryable: true
              }
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
                siteInfo: null
              },
              error: null
            };
          }
          
          // Get site information
          const sites = await getDistractingSites();
          const site = sites.find(s => s.id === siteId);
          
          if (!site) {
            return {
              success: true,
              data: {
                url: activeTab.url,
                hostname: new URL(activeTab.url).hostname,
                isDistractingSite: false,
                siteInfo: null
              },
              error: null
            };
          }
          
          return {
            success: true,
            data: {
              url: activeTab.url,
              hostname: new URL(activeTab.url).hostname,
              isDistractingSite: true,
              siteInfo: site
            },
            error: null
          };
          
        } catch (error) {
          console.error('[Main] Error getting current page limit info:', error);
          return {
            success: false,
            error: {
              message: 'Failed to get current page information',
              type: ERROR_TYPES.SYSTEM,
              isRetryable: true
            }
          };
        }
      }
      
      case 'addQuickLimit': {
        const validation = validateRequiredFields(message.payload, ['urlPattern', 'dailyLimitSeconds']);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              message: validation.error,
              type: ERROR_TYPES.VALIDATION,
              isRetryable: false,
              field: validation.missingField
            }
          };
        }
        
        const newSite = await addDistractingSite(message.payload);
        if (!newSite) {
          return {
            success: false,
            error: {
              message: 'Failed to add site limit. Please check the URL format and try again.',
              type: ERROR_TYPES.STORAGE,
              isRetryable: true
            }
          };
        }
        
        // Reload distraction detector cache when sites change
        await _reloadDistractionDetectorCache();
        
        // Refresh badge for current tab
        await refreshCurrentTabBadge();
        
        return { 
          success: true, 
          data: newSite,
          error: null
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
              field: validation.missingField
            }
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
                badgeText: "",
                limitInfo: null
              },
              error: null
            };
          }
          
          // Get site and usage information
          const [sites, usageStats] = await Promise.all([
            getDistractingSites(),
            import('./usage_storage.js').then(module => 
              module.getUsageStats(new Date().toISOString().split('T')[0])
            )
          ]);
          
          const site = sites.find(s => s.id === siteId);
          if (!site || !site.isEnabled) {
            return {
              success: true,
              data: {
                showBadge: false,
                badgeText: "",
                limitInfo: null
              },
              error: null
            };
          }
          
          const siteUsage = usageStats[siteId] || { timeSpentSeconds: 0, opens: 0 };
          
          return {
            success: true,
            data: {
              showBadge: true,
              badgeText: "Will be calculated by badge manager",
              limitInfo: {
                site: site,
                usage: siteUsage
              }
            },
            error: null
          };
          
        } catch (error) {
          console.error('[Main] Error getting badge info:', error);
          return {
            success: false,
            error: {
              message: 'Failed to get badge information',
              type: ERROR_TYPES.SYSTEM,
              isRetryable: true
            }
          };
        }
      }
      
      // === Debug/Status API ===
      case 'getSystemStatus': {
        const status = {
          isActive: _orchestrationState.isSystemActive,
          currentlyTrackedSiteId: _orchestrationState.currentlyTrackedSiteId,
          lastActiveUrl: _orchestrationState.lastActiveUrl,
          timestamp: Date.now()
        };
        return { 
          success: true, 
          data: status,
          error: null
        };
      }
      
      default:
        console.warn('[Main] Unknown message action:', message.action);
        return { 
          success: false, 
          error: {
            message: `Unknown action: ${message.action}`,
            type: ERROR_TYPES.VALIDATION,
            isRetryable: false
          }
        };
    }
  } catch (error) {
    console.error('[Main] Error handling message:', error);
    
    const categorized = categorizeError(error);
    return { 
      success: false, 
      error: {
        message: categorized.userMessage,
        type: categorized.type,
        isRetryable: categorized.isRetryable,
        originalError: error.message
      }
    };
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
    const { loadDistractingSitesFromStorage } = await import('./distraction_detector.js');
    await loadDistractingSitesFromStorage();
    console.log('[Main] Reloaded distraction detector cache after sites change');
  } catch (error) {
    console.error('[Main] Error reloading distraction detector cache:', error);
    // This is not critical for functionality, so we continue without throwing
  }
}

/**
 * Handles toolbar action button clicks.
 * The popup will open automatically due to manifest configuration,
 * but we can handle cases where popup is disabled or fails to open.
 * @param {Object} tab - The tab where the action was clicked
 */
async function handleActionClick(tab) {
  console.log('[Main] Toolbar action clicked for tab:', tab.id, tab.url);
  
  try {
    // If popup fails to open for any reason, we could implement fallback behavior here
    // For now, we just log the event since the popup should handle the interaction
    
    // Update badge for the current tab to ensure it's up to date
    if (tab.url) {
      await updateBadgeForTab(tab.id, tab.url);
    }
    
  } catch (error) {
    console.error('[Main] Error handling action click:', error);
  }
}

/**
 * Enhanced tab activity change handler that also updates badge text.
 * @param {Object} activityInfo - Activity information from tab monitor
 */
async function handleTabActivityChangeWithBadge(activityInfo) {
  const { tabId, url, isFocused } = activityInfo;
  
  // Call original handler
  await handleTabActivityChange(activityInfo);
  
  // Update badge for the new active tab
  if (isFocused && tabId && url) {
    try {
      await updateBadgeForTab(tabId, url);
    } catch (error) {
      console.error('[Main] Error updating badge during tab activity change:', error);
    }
  }
}

/**
 * Initializes all background script modules and sets up orchestration.
 * This is the main startup function called when the background script loads.
 * Enhanced with better error handling and recovery.
 */
async function initialize() {
  console.log('[Main] Initializing Firefox Distraction Limiter background script...');
  
  const initializationErrors = [];
  
  try {
    // Initialize core modules with individual error handling
    console.log('[Main] Initializing daily reset alarm...');
    try {
      await initializeDailyResetAlarm();
    } catch (error) {
      console.error('[Main] Failed to initialize daily reset alarm:', error);
      initializationErrors.push({ module: 'daily_reset', error: error.message });
    }
    
    console.log('[Main] Initializing usage recorder...');
    try {
      initializeUsageRecorder();
    } catch (error) {
      console.error('[Main] Failed to initialize usage recorder:', error);
      initializationErrors.push({ module: 'usage_recorder', error: error.message });
    }
    
    console.log('[Main] Initializing distraction detector...');
    try {
      await initializeDistractionDetector();
    } catch (error) {
      console.error('[Main] Failed to initialize distraction detector:', error);
      initializationErrors.push({ module: 'distraction_detector', error: error.message });
    }
    
    console.log('[Main] Initializing badge manager...');
    try {
      await initializeBadgeManager();
    } catch (error) {
      console.error('[Main] Failed to initialize badge manager:', error);
      initializationErrors.push({ module: 'badge_manager', error: error.message });
    }
    
    console.log('[Main] Initializing tab activity monitor...');
    try {
      await initializeTabActivityMonitor(handleTabActivityChangeWithBadge);
    } catch (error) {
      console.error('[Main] Failed to initialize tab activity monitor:', error);
      initializationErrors.push({ module: 'tab_activity_monitor', error: error.message });
    }
    
    // Set up message listener for UI communication
    try {
      browser.runtime.onMessage.addListener(handleMessage);
      console.log('[Main] Message listener set up successfully');
    } catch (error) {
      console.error('[Main] Failed to set up message listener:', error);
      initializationErrors.push({ module: 'message_listener', error: error.message });
    }
    
    // Set up action button click handler
    try {
      browser.action.onClicked.addListener(handleActionClick);
      console.log('[Main] Action click listener set up successfully');
    } catch (error) {
      console.error('[Main] Failed to set up action click listener:', error);
      initializationErrors.push({ module: 'action_listener', error: error.message });
    }
    
    if (initializationErrors.length > 0) {
      console.warn('[Main] Background script initialized with errors:', initializationErrors);
      // Extension can still function with some modules failing
    } else {
      console.log('[Main] Background script initialization complete - all modules loaded successfully');
    }
    
  } catch (error) {
    console.error('[Main] Critical error during initialization:', error);
    // Even with critical errors, try to continue with basic functionality
  }
}

// === Background Script Entry Point ===

// Initialize the extension when the background script loads
initialize().catch(error => {
  console.error('[Main] Fatal error during initialization:', error);
  // Extension will continue to run with limited functionality
});

console.log('[Main] Firefox Distraction Limiter background script loaded');
