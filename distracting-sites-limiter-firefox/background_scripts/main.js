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
 * 
 * @param {Object} message - The message object sent from UI
 * @param {string} message.action - The action to perform
 * @param {Object} [message.payload] - Data associated with the action
 * @returns {Promise<any>|boolean} Response data or boolean indicating async response
 */
async function handleMessage(message) {
  console.log('[Main] Received message:', message.action, message.payload);
  
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
          data: { distractingSites, timeoutNotes } 
        };
      }
      
      // === Distracting Sites Management ===
      case 'addDistractingSite': {
        if (!message.payload) {
          throw new Error('Payload required for addDistractingSite');
        }
        const newSite = await addDistractingSite(message.payload);
        // Reload distraction detector cache when sites change
        await _reloadDistractionDetectorCache();
        return { 
          success: true, 
          data: newSite 
        };
      }
      
      case 'updateDistractingSite': {
        if (!message.payload || !message.payload.id) {
          throw new Error('Payload with id required for updateDistractingSite');
        }
        const updatedSite = await updateDistractingSite(message.payload.id, message.payload.updates);
        await _reloadDistractionDetectorCache();
        return { 
          success: true, 
          data: updatedSite 
        };
      }
      
      case 'deleteDistractingSite': {
        if (!message.payload || !message.payload.id) {
          throw new Error('Payload with id required for deleteDistractingSite');
        }
        const deleteResult = await deleteDistractingSite(message.payload.id);
        await _reloadDistractionDetectorCache();
        return { 
          success: true, 
          data: deleteResult 
        };
      }
      
      // === Timeout Notes Management ===
      case 'addTimeoutNote': {
        if (!message.payload) {
          throw new Error('Payload required for addTimeoutNote');
        }
        const newNote = await addTimeoutNote(message.payload);
        return { 
          success: true, 
          data: newNote 
        };
      }
      
      case 'updateTimeoutNote': {
        if (!message.payload || !message.payload.id) {
          throw new Error('Payload with id required for updateTimeoutNote');
        }
        const updatedNote = await updateTimeoutNote(message.payload.id, message.payload.updates);
        return { 
          success: true, 
          data: updatedNote 
        };
      }
      
      case 'deleteTimeoutNote': {
        if (!message.payload || !message.payload.id) {
          throw new Error('Payload with id required for deleteTimeoutNote');
        }
        const deleteResult = await deleteTimeoutNote(message.payload.id);
        return { 
          success: true, 
          data: deleteResult 
        };
      }
      
      // === Timeout Page API ===
      case 'getTimeoutNotes': {
        const notes = await getTimeoutNotes();
        return { 
          success: true, 
          data: notes 
        };
      }
      
      case 'getRandomTimeoutNote': {
        const notes = await getTimeoutNotes();
        if (notes && notes.length > 0) {
          const randomIndex = Math.floor(Math.random() * notes.length);
          return { 
            success: true, 
            data: notes[randomIndex] 
          };
        }
        return { 
          success: true, 
          data: null 
        };
      }
      
      // === Debug/Status API ===
      case 'getSystemStatus': {
        const status = {
          isActive: _orchestrationState.isSystemActive,
          currentlyTrackedSiteId: _orchestrationState.currentlyTrackedSiteId,
          lastActiveUrl: _orchestrationState.lastActiveUrl,
        };
        return { 
          success: true, 
          data: status 
        };
      }
      
      default:
        console.warn('[Main] Unknown message action:', message.action);
        return { 
          success: false, 
          error: `Unknown action: ${message.action}` 
        };
    }
  } catch (error) {
    console.error('[Main] Error handling message:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Helper function to reload the distraction detector cache when sites change.
 * This ensures the detector always has up-to-date site information.
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
  }
}

/**
 * Initializes all background script modules and sets up orchestration.
 * This is the main startup function called when the background script loads.
 */
async function initialize() {
  console.log('[Main] Initializing Firefox Distraction Limiter background script...');
  
  try {
    // Initialize core modules
    console.log('[Main] Initializing daily reset alarm...');
    await initializeDailyResetAlarm();
    
    console.log('[Main] Initializing usage recorder...');
    initializeUsageRecorder();
    
    console.log('[Main] Initializing distraction detector...');
    await initializeDistractionDetector();
    
    console.log('[Main] Initializing tab activity monitor...');
    await initializeTabActivityMonitor(handleTabActivityChange);
    
    // Set up message listener for UI communication
    browser.runtime.onMessage.addListener(handleMessage);
    
    console.log('[Main] Background script initialization complete');
    
  } catch (error) {
    console.error('[Main] Error during initialization:', error);
    // Continue running even if some modules fail to initialize
  }
}

// === Background Script Entry Point ===

// Initialize the extension when the background script loads
initialize().catch(error => {
  console.error('[Main] Fatal error during initialization:', error);
});

console.log('[Main] Firefox Distraction Limiter background script loaded');
