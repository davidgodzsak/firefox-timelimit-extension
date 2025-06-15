/**
 * @file main.js
 * @description Main background script orchestrator for the Firefox Distraction Limiter extension.
 * This is the central entry point that initializes all background modules and coordinates
 * their interactions. It handles:
 * - Daily reset alarm initialization
 * - Tab activity monitoring and distraction detection
 * - Time tracking and usage recording
 * - Site blocking when limits are exceeded
 * - Message passing with UI components (settings and timeout pages)
 * 
 * Architecture:
 * - Tab Activity Monitor: Detects tab changes and browser focus
 * - Distraction Detector: Checks if URLs match distracting sites
 * - Usage Recorder: Tracks time spent and opens for distracting sites  
 * - Site Blocker: Enforces limits by redirecting to timeout page
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

// Storage module imports for message handling
import { getDistractingSites, addDistractingSite, updateDistractingSite, deleteDistractingSite } from './site_storage.js';
import { getTimeoutNotes, addTimeoutNote, updateTimeoutNote, deleteTimeoutNote } from './note_storage.js';

// Enhanced validation and error handling utilities
import { 
  categorizeError, 
  validateRequiredFields, 
  safeBrowserApiCall,
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
        } else {
          console.log(`[Main] Site ${siteId} was blocked and redirected`);
        }
      } catch (error) {
        console.error('[Main] Error during site blocking check:', error);
        // If blocking check fails, still start tracking to avoid data loss
        await recordSiteOpen(siteId);
        await startTrackingSiteTime(siteId);
        _orchestrationState.currentlyTrackedSiteId = siteId;
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
 * @param {Object} sender - Information about the message sender
 * @param {Function} sendResponse - Function to send response back
 * @returns {Promise<any>|boolean} Response data or boolean indicating async response
 */
async function handleMessage(message, sender, sendResponse) {
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
    
    console.log('[Main] Initializing tab activity monitor...');
    try {
      await initializeTabActivityMonitor(handleTabActivityChange);
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
