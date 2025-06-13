/**
 * @file timeout.js
 * @description Handles the display of blocked site information and alternative activities
 * on the timeout page.
 */

import { getTimeoutNotes } from '../../background_scripts/note_storage.js';

/**
 * Extracts and validates URL parameters.
 * @returns {{blockedUrl: string, siteId: string, reason: string}} The URL parameters
 */
function getUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    return {
        blockedUrl: params.get('blockedUrl') || 'Unknown URL',
        siteId: params.get('siteId') || '',
        reason: params.get('reason') || 'Time limit reached'
    };
}

/**
 * Updates the page with blocked site information.
 * @param {Object} params - The URL parameters containing site information
 */
function displayBlockedInfo(params) {
    const blockedUrlElement = document.getElementById('blocked-url');
    const blockReasonElement = document.getElementById('block-reason');

    try {
        const url = new URL(params.blockedUrl);
        blockedUrlElement.textContent = `Site blocked: ${url.hostname}`;
    } catch (error) {
        blockedUrlElement.textContent = 'Site blocked: Invalid URL';
        console.error('[Timeout] Error parsing blocked URL:', error);
    }

    blockReasonElement.textContent = params.reason;
}

/**
 * Creates and returns a DOM element for an activity.
 * @param {Object} activity - The activity object containing text
 * @returns {HTMLElement} The created activity element
 */
function createActivityElement(activity) {
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.textContent = activity.text;
    return div;
}

/**
 * Displays alternative activities on the page.
 * @param {Array} activities - Array of activity objects
 */
function displayAlternativeActivities(activities) {
    const container = document.getElementById('alternative-activities');
    container.innerHTML = ''; // Clear existing content

    if (!activities || activities.length === 0) {
        const message = document.createElement('p');
        message.textContent = 'No alternative activities available. Take a break!';
        container.appendChild(message);
        return;
    }

    // Randomly select up to 3 activities to display
    const selectedActivities = activities
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

    selectedActivities.forEach(activity => {
        container.appendChild(createActivityElement(activity));
    });
}

/**
 * Initializes the timeout page.
 */
async function initTimeoutPage() {
    try {
        const params = getUrlParameters();
        displayBlockedInfo(params);

        const activities = await getTimeoutNotes();
        displayAlternativeActivities(activities);
    } catch (error) {
        console.error('[Timeout] Error initializing timeout page:', error);
        // Display a basic message even if there's an error
        displayBlockedInfo({
            blockedUrl: 'Error loading site information',
            reason: 'Please check your extension settings'
        });
    }
}

// Initialize the page when the DOM is ready
document.addEventListener('DOMContentLoaded', initTimeoutPage); 