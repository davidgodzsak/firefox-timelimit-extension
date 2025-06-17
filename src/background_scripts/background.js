/**
 * @file background.js
 * @description Event-driven background script for the Firefox Distraction Limiter extension.
 * This is the new entry point that replaces main.js with a Manifest V3 compatible
 * event-driven architecture. It acts as an event router, listening to browser events
 * and dispatching them to appropriate handler modules.
 * 
 * Key responsibilities:
 * - Listen to browser.runtime.onInstalled to initialize alarms
 * - Listen to browser.alarms.onAlarm to handle scheduled tasks
 * - Listen to browser.webNavigation.onBeforeNavigate for proactive site blocking
 * - Route events to appropriate modules (daily reset, usage tracking, site blocking, etc.)
 * - Maintain stateless architecture with chrome.storage as single source of truth
 */

import { initializeDailyResetAlarm, performDailyReset } from './daily_reset.js';
import { handlePotentialRedirect } from './site_blocker.js';
import { startTracking, stopTracking, updateUsage, getCurrentTrackingInfo } from './usage_recorder.js';
import { checkIfUrlIsDistracting, initializeDistractionDetector } from './distraction_detector.js';

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
  console.log(`[Background] Alarm "${alarm.name}" triggered at ${new Date(alarm.scheduledTime).toISOString()}`);
  
  try {
    switch (alarm.name) {
      case 'dailyResetAlarm':
        await performDailyReset();
        console.log('[Background] Daily reset completed successfully');
        break;
        
      case 'usageTimer':
        // Update usage for currently tracked site
        const totalTimeSeconds = await updateUsage();
        console.log(`[Background] Usage updated via alarm. Total time: ${totalTimeSeconds}s`);
        
        // Update badge for current tracking info
        try {
          const trackingInfo = await getCurrentTrackingInfo();
          if (trackingInfo.isTracking && trackingInfo.tabId) {
            // Import badge manager dynamically to avoid circular dependencies
            const badgeManager = await import('./badge_manager.js');
            await badgeManager.updateBadge(trackingInfo.tabId);
          }
        } catch (error) {
          console.warn('[Background] Error updating badge after usage alarm:', error);
          // Continue without badge update - non-critical
        }
        break;
      
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
    // Check if the site should be blocked and redirect if necessary
    const wasRedirected = await handlePotentialRedirect(tabId, url);
    
    if (wasRedirected) {
      console.log(`[Background] Successfully blocked navigation to ${url} in tab ${tabId}`);
    }
  } catch (error) {
    console.error('[Background] Error during navigation blocking check:', error);
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
  } catch (error) {
    console.error(`[Background] Error handling tab activation for tab ${tabId}:`, error);
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
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    const isActiveTab = activeTab && activeTab.id === tabId;
    
    // Check if browser window is focused
    const currentWindow = await browser.windows.getCurrent();
    const isWindowFocused = currentWindow && currentWindow.focused;
    
    const shouldTrack = isActiveTab && isWindowFocused;
    await handleTabActivity(tabId, newUrl, shouldTrack);
  } catch (error) {
    console.error(`[Background] Error handling tab update for tab ${tabId}:`, error);
  }
}

/**
 * Handles window focus change events.
 * Starts or stops usage tracking based on window focus state.
 * @param {number} windowId - The ID of the focused window (or browser.windows.WINDOW_ID_NONE)
 */
async function handleWindowFocusChanged(windowId) {
  const isWindowFocused = windowId !== browser.windows.WINDOW_ID_NONE;
  console.log(`[Background] Window focus changed. Focused: ${isWindowFocused}`);

  try {
    if (isWindowFocused) {
      // Window gained focus - check if we should start tracking
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.url) {
        await handleTabActivity(activeTab.id, activeTab.url, true);
      }
    } else {
      // Window lost focus - stop tracking
      await handleTabActivity(null, null, false);
    }
  } catch (error) {
    console.error('[Background] Error handling window focus change:', error);
  }
}

/**
 * Core logic for determining when to start or stop usage tracking.
 * @param {number|null} tabId - The tab ID (null when stopping tracking)
 * @param {string|null} url - The URL (null when stopping tracking)
 * @param {boolean} shouldTrack - Whether conditions are met for tracking
 */
async function handleTabActivity(tabId, url, shouldTrack) {
  try {
    const trackingInfo = await getCurrentTrackingInfo();
    
    if (!shouldTrack) {
      // Stop tracking if currently active
      if (trackingInfo.isTracking) {
        console.log('[Background] Stopping tracking due to tab/window change');
        await stopTracking();
        await browser.alarms.clear('usageTimer');
      }
      return;
    }

    // Check if URL is a distracting site
    const distractionCheck = checkIfUrlIsDistracting(url);
    
    if (distractionCheck.isMatch) {
      // Start tracking this distracting site
      if (!trackingInfo.isTracking || 
          trackingInfo.siteId !== distractionCheck.siteId || 
          trackingInfo.tabId !== tabId) {
        
        console.log(`[Background] Starting tracking for distracting site: ${distractionCheck.siteId} in tab: ${tabId}`);
        
        // Start tracking (this will stop any previous tracking)
        const success = await startTracking(tabId, distractionCheck.siteId);
        
        if (success) {
          // Create the periodic usage update alarm (every minute)
          await browser.alarms.create('usageTimer', { 
            delayInMinutes: 1, 
            periodInMinutes: 1 
          });
          
          // Update badge immediately
          try {
            const badgeManager = await import('./badge_manager.js');
            await badgeManager.updateBadge(tabId);
          } catch (error) {
            console.warn('[Background] Error updating badge after starting tracking:', error);
          }
        }
      }
    } else {
      // Not a distracting site - stop tracking if currently active
      if (trackingInfo.isTracking) {
        console.log('[Background] Stopping tracking - no longer on distracting site');
        await stopTracking();
        await browser.alarms.clear('usageTimer');
      }
    }
  } catch (error) {
    console.error('[Background] Error in handleTabActivity:', error);
  }
}

// Set up event listeners
browser.runtime.onInstalled.addListener(handleInstalled);
browser.alarms.onAlarm.addListener(handleAlarm);
browser.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);

// Add new event listeners for tab and window activity
browser.tabs.onActivated.addListener(handleTabActivated);
browser.tabs.onUpdated.addListener(handleTabUpdated);
browser.windows.onFocusChanged.addListener(handleWindowFocusChanged);

console.log('[Background] Event-driven background script loaded with usage tracking capability'); 