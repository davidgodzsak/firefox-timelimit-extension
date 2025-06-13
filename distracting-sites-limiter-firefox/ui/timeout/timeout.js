/**
 * @file timeout.js
 * @description Handles the display of blocked site information and alternative activities
 * on the timeout page when a user's daily time limit is exceeded.
 * 
 * This script:
 * - Parses URL parameters to get blocked site information
 * - Communicates with background scripts to fetch timeout notes
 * - Displays the blocked site URL and motivational alternatives
 * - Provides a calm, encouraging user experience
 */

/**
 * Configuration constants
 */
const CONFIG = {
    MAX_ACTIVITIES_SHOWN: 3,
    LOADING_TIMEOUT: 5000, // 5 seconds
    DEFAULT_REASON: 'Your daily time limit for this site has been reached.'
};

/**
 * Extracts and validates URL parameters from the current page URL.
 * 
 * @returns {Object} Object containing parsed URL parameters
 * @returns {string} returns.blockedUrl - The original URL that was blocked
 * @returns {string} returns.siteId - The site ID from the distracting sites list
 * @returns {string} returns.reason - The reason for blocking (optional)
 */
function getUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    
    return {
        blockedUrl: params.get('blockedUrl') || '',
        siteId: params.get('siteId') || '',
        reason: params.get('reason') || CONFIG.DEFAULT_REASON
    };
}

/**
 * Safely parses a URL and extracts the hostname.
 * 
 * @param {string} urlString - The URL string to parse
 * @returns {string} The hostname or fallback text
 */
function extractHostname(urlString) {
    if (!urlString) {
        return 'Unknown site';
    }
    
    try {
        // Handle URLs that might not have a protocol
        const url = urlString.startsWith('http') 
            ? new URL(urlString)
            : new URL(`https://${urlString}`);
        return url.hostname;
    } catch (error) {
        console.warn('[Timeout] Error parsing URL:', urlString, error);
        // Try to extract hostname manually as fallback
        const match = urlString.match(/(?:https?:\/\/)?(?:www\.)?([^/?#]+)/);
        return match ? match[1] : urlString;
    }
}

/**
 * Updates the page with information about the blocked site.
 * 
 * @param {Object} params - The URL parameters containing site information
 * @param {string} params.blockedUrl - The blocked URL
 * @param {string} params.reason - The reason for blocking
 */
function displayBlockedInfo(params) {
    const blockedUrlElement = document.getElementById('blocked-url');
    const blockReasonElement = document.getElementById('block-reason');
    
    if (!blockedUrlElement || !blockReasonElement) {
        console.error('[Timeout] Required DOM elements not found');
        return;
    }
    
    try {
        const hostname = extractHostname(params.blockedUrl);
        blockedUrlElement.textContent = `Site blocked: ${hostname}`;
        blockReasonElement.textContent = params.reason;
        
        // Update page title with the blocked site
        document.title = `Site Blocked: ${hostname} - Time Limit Reached`;
    } catch (error) {
        console.error('[Timeout] Error displaying blocked info:', error);
        blockedUrlElement.textContent = 'Site blocked: Unable to display URL';
        blockReasonElement.textContent = params.reason;
    }
}

/**
 * Creates a DOM element for displaying an alternative activity.
 * 
 * @param {Object} activity - The activity object
 * @param {string} activity.text - The activity description
 * @param {string} activity.id - The activity ID
 * @returns {HTMLElement} The created activity element
 */
function createActivityElement(activity) {
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.setAttribute('role', 'listitem');
    div.textContent = activity.text;
    
    // Add accessibility attributes
    div.setAttribute('aria-label', `Suggested activity: ${activity.text}`);
    
    return div;
}

/**
 * Displays alternative activities to encourage the user to do something else.
 * 
 * @param {Array} activities - Array of activity objects from timeout notes
 */
function displayAlternativeActivities(activities) {
    const container = document.getElementById('alternative-activities');
    
    if (!container) {
        console.error('[Timeout] Alternative activities container not found');
        return;
    }
    
    // Clear existing content and loading state
    container.innerHTML = '';
    container.classList.remove('loading');
    
    // Handle empty activities array
    if (!activities || activities.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'activity-empty';
        emptyDiv.textContent = 'No alternative activities configured. Why not take a moment to step away from the screen?';
        container.appendChild(emptyDiv);
        return;
    }
    
    // Randomly select activities to display (up to the configured maximum)
    const selectedActivities = activities
        .filter(activity => activity && activity.text) // Filter out invalid activities
        .sort(() => Math.random() - 0.5) // Shuffle array
        .slice(0, CONFIG.MAX_ACTIVITIES_SHOWN);
    
    // Create and append activity elements
    selectedActivities.forEach(activity => {
        try {
            const activityElement = createActivityElement(activity);
            container.appendChild(activityElement);
        } catch (error) {
            console.error('[Timeout] Error creating activity element:', error);
        }
    });
    
    // If we have fewer activities than expected, show a message
    if (selectedActivities.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'activity-empty';
        emptyDiv.textContent = 'Unable to load alternative activities. Consider taking a break!';
        container.appendChild(emptyDiv);
    }
}

/**
 * Shows a loading state in the activities container.
 */
function showLoadingState() {
    const container = document.getElementById('alternative-activities');
    if (container) {
        container.innerHTML = '';
        container.className = 'alternative-activities loading';
        container.textContent = 'Loading alternative activities...';
    }
}

/**
 * Requests timeout notes from the background script using message passing.
 * 
 * @returns {Promise<Array>} Promise that resolves to an array of timeout notes
 */
async function fetchTimeoutNotes() {
    try {
        // Send message to background script to get timeout notes
        const response = await browser.runtime.sendMessage({
            action: 'getTimeoutNotes'
        });
        
        if (response && response.success) {
            return response.data || [];
        } else {
            console.warn('[Timeout] Failed to fetch timeout notes:', response?.error);
            return [];
        }
    } catch (error) {
        console.error('[Timeout] Error communicating with background script:', error);
        return [];
    }
}

/**
 * Handles errors that occur during initialization.
 * 
 * @param {Error} error - The error that occurred
 * @param {Object} params - The URL parameters for fallback display
 */
function handleInitializationError(error, params) {
    console.error('[Timeout] Error initializing timeout page:', error);
    
    // Still try to display basic blocked site info
    displayBlockedInfo({
        blockedUrl: params.blockedUrl || 'Unknown site',
        reason: 'Unable to load complete site information. Please check your extension settings.'
    });
    
    // Show error message for activities
    displayAlternativeActivities([]);
}

/**
 * Initializes the timeout page by loading site info and alternative activities.
 * This is the main entry point called when the page loads.
 */
async function initializeTimeoutPage() {
    try {
        // Get URL parameters
        const params = getUrlParameters();
        
        // Display blocked site information immediately
        displayBlockedInfo(params);
        
        // Show loading state for activities
        showLoadingState();
        
        // Set up a timeout for loading activities
        const loadingTimeout = setTimeout(() => {
            console.warn('[Timeout] Loading timeout reached, showing fallback');
            displayAlternativeActivities([]);
        }, CONFIG.LOADING_TIMEOUT);
        
        // Fetch and display alternative activities
        const activities = await fetchTimeoutNotes();
        clearTimeout(loadingTimeout);
        displayAlternativeActivities(activities);
        
    } catch (error) {
        handleInitializationError(error, getUrlParameters());
    }
}

/**
 * Handles the page visibility change to potentially refresh content.
 * This ensures the page stays up-to-date if the user switches tabs and comes back.
 */
function handleVisibilityChange() {
    if (!document.hidden) {
        // Page became visible again, potentially refresh activities
        console.log('[Timeout] Page became visible, content is current');
    }
}

/**
 * Sets up event listeners and initializes the page.
 * This function is called when the DOM is ready.
 */
function setupEventListeners() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle potential errors in the console for debugging
    window.addEventListener('error', (event) => {
        console.error('[Timeout] Uncaught error:', event.error);
    });
}

// Initialize the page when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        initializeTimeoutPage();
    });
} else {
    // DOM is already ready
    setupEventListeners();
    initializeTimeoutPage();
} 