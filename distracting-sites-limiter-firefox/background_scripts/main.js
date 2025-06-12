/**
 * @file main.js
 * @description This is the main entry point for the extension's background script.
 * It initializes all other background modules and sets up message listeners
 * for communication with the UI components.
 */

import { initializeDailyResetAlarm } from './daily_reset.js';
import { initializeDistractionDetector } from './distraction_detector.js';
import { getDistractingSites, addDistractingSite, updateDistractingSite, deleteDistractingSite } from './site_storage.js';
import { getTimeoutNotes, addTimeoutNote, updateTimeoutNote, deleteTimeoutNote } from './note_storage.js';

/**
 * Initializes all the background script modules.
 */
async function initialize() {
  // Initialize the daily reset alarm
  initializeDailyResetAlarm();
  
  // Initialize the distraction detector
  await initializeDistractionDetector();
}

/**
 * Handles incoming messages from other parts of the extension (e.g., settings page).
 * @param {Object} message - The message object sent from the UI.
 * @param {string} message.action - The action to be performed.
 * @param {Object} message.payload - The data associated with the action.
 * @param {browser.runtime.MessageSender} sender - Information about the message sender.
 * @returns {Promise<any>|boolean} A promise that resolves with the response, or true to indicate an async response.
 */
function handleMessage(message, sender) {
  // For now, we just log the messages.
  // In the future, this will be expanded to handle CRUD operations.
  switch (message.action) {
    case 'getAllSettings':
      return Promise.all([getDistractingSites(), getTimeoutNotes()])
        .then(([distractingSites, timeoutNotes]) => ({ distractingSites, timeoutNotes }));
    // Site storage actions
    case 'addDistractingSite':
      return addDistractingSite(message.payload);
    case 'updateDistractingSite':
      return updateDistractingSite(message.payload.id, message.payload.updates);
    case 'deleteDistractingSite':
      return deleteDistractingSite(message.payload.id);
    // Note storage actions
    case 'addTimeoutNote':
        return addTimeoutNote(message.payload);
    case 'updateTimeoutNote':
        return updateTimeoutNote(message.payload.id, message.payload.updates);
    case 'deleteTimeoutNote':
        return deleteTimeoutNote(message.payload.id);
    default:
      console.warn('Unknown message action:', message.action);
      return false; // No async response
  }
  return true; // Indicates that the response will be sent asynchronously
}

// --- Script Entry Point ---

// Add the message listener
browser.runtime.onMessage.addListener(handleMessage);

// Initialize the background script modules
initialize();
