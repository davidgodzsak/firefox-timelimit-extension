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
 * - Route events to appropriate modules (daily reset, usage tracking, etc.)
 * - Maintain stateless architecture with chrome.storage as single source of truth
 */

import { initializeDailyResetAlarm, performDailyReset } from './daily_reset.js';

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
  } catch (error) {
    console.error('[Background] Error initializing daily reset alarm:', error);
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
      
      default:
        console.warn(`[Background] Unknown alarm: ${alarm.name}`);
        break;
    }
  } catch (error) {
    console.error(`[Background] Error handling alarm "${alarm.name}":`, error);
  }
}

// Set up event listeners
browser.runtime.onInstalled.addListener(handleInstalled);
browser.alarms.onAlarm.addListener(handleAlarm);

console.log('[Background] Event-driven background script loaded'); 