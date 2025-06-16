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
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
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
 * The entire element is clickable for shuffling to a new activity.
 * 
 * @param {Object} activity - The activity object
 * @param {string} activity.text - The activity description
 * @param {string} activity.id - The activity ID
 * @returns {HTMLElement} The created activity element
 */
function createActivityElement(activity) {
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.textContent = activity.text;
    
    // Add accessibility attributes
    div.setAttribute('aria-label', `Suggested activity: ${activity.text}. Click to get a new suggestion.`);
    div.setAttribute('title', 'Click to get a new suggestion');
    
    return div;
}

/**
 * Displays alternative activities to encourage the user to do something else.
 * 
 * @param {Array} activities - Array containing a single activity object or empty
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
    
    // Handle empty activities array or null activity
    const validActivities = activities.filter(activity => activity && activity.text);
    
    if (validActivities.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'activity-empty';
        emptyDiv.textContent = 'No alternative activities configured. Why not take a moment to step away from the screen?';
        container.appendChild(emptyDiv);
        return;
    }
    
    // Display the single activity (no random selection needed since we get one random note)
    try {
        const activityElement = createActivityElement(validActivities[0]);
        container.appendChild(activityElement);
    } catch (error) {
        console.error('[Timeout] Error creating activity element:', error);
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
 * Requests a random timeout note from the background script using message passing.
 * Enhanced with retry logic and better error handling.
 * 
 * @param {number} attempt - Current attempt number (for retry logic)
 * @returns {Promise<Object|null>} Promise that resolves to a single random timeout note or null
 */
async function fetchRandomTimeoutNote(attempt = 1) {
    try {
        // Check if browser API is available
        if (typeof browser === 'undefined' || !browser.runtime) {
            console.error('[Timeout] Browser extension API not available');
            return null;
        }
        
        // Send message to background script to get a random timeout note
        const response = await browser.runtime.sendMessage({
            action: 'getRandomTimeoutNote'
        });
        
        if (response && response.success) {
            return response.data; // This will be a single note object or null
        } else {
            const error = response?.error;
            console.warn('[Timeout] Failed to fetch random timeout note:', error);
            
            // Handle different error types
            if (error?.type === 'EXTENSION_CONTEXT_ERROR') {
                console.error('[Timeout] Extension context invalidated, cannot retry');
                return null;
            } else if (error?.type === 'STORAGE_ERROR' && attempt < CONFIG.RETRY_ATTEMPTS) {
                console.log(`[Timeout] Storage error, retrying in ${CONFIG.RETRY_DELAY}ms (attempt ${attempt}/${CONFIG.RETRY_ATTEMPTS})`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
                return fetchRandomTimeoutNote(attempt + 1);
            } else if (error?.isRetryable && attempt < CONFIG.RETRY_ATTEMPTS) {
                console.log(`[Timeout] Retryable error, retrying in ${CONFIG.RETRY_DELAY}ms (attempt ${attempt}/${CONFIG.RETRY_ATTEMPTS})`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
                return fetchRandomTimeoutNote(attempt + 1);
            }
            
            return null;
        }
    } catch (error) {
        console.error('[Timeout] Error communicating with background script:', error);
        
        // Handle specific error types
        if (error.message.includes('Extension context invalidated') || 
            error.message.includes('Receiving end does not exist')) {
            console.error('[Timeout] Extension context invalidated, page may need refresh');
            return null;
        }
        
        // Retry for other errors if attempts remain
        if (attempt < CONFIG.RETRY_ATTEMPTS) {
            console.log(`[Timeout] Error occurred, retrying in ${CONFIG.RETRY_DELAY}ms (attempt ${attempt}/${CONFIG.RETRY_ATTEMPTS})`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return fetchRandomTimeoutNote(attempt + 1);
        }
        
        return null;
    }
}

/**
 * Handles errors that occur during initialization.
 * Enhanced with better error categorization and user feedback.
 * 
 * @param {Error} error - The error that occurred
 * @param {Object} params - The URL parameters for fallback display
 */
function handleInitializationError(error, params) {
    console.error('[Timeout] Error initializing timeout page:', error);
    
    // Still display basic blocked site information even on error
    try {
        displayBlockedInfo(params);
    } catch (displayError) {
        console.error('[Timeout] Error displaying blocked info:', displayError);
        // Set fallback content
        const blockedUrlElement = document.getElementById('blocked-url');
        const blockReasonElement = document.getElementById('block-reason');
        
        if (blockedUrlElement) {
            blockedUrlElement.textContent = 'Site blocked: Time limit reached';
        }
        if (blockReasonElement) {
            blockReasonElement.textContent = 'Your daily time limit for this site has been reached.';
        }
    }
    
    // Show appropriate error message based on error type
    const container = document.getElementById('alternative-activities');
    if (container) {
        container.innerHTML = '';
        container.classList.remove('loading');
        
        let errorMessage = 'Unable to load alternative activities.';
        let showRetryButton = false;
        
        if (error.message.includes('Extension context invalidated') || 
            error.message.includes('Extension was reloaded')) {
            errorMessage = 'Extension was reloaded. Please refresh this page for full functionality.';
            showRetryButton = true;
        } else if (error.message.includes('Storage error') || 
                   error.message.includes('storage')) {
            errorMessage = 'Unable to load activities due to storage error. Consider taking a break!';
        } else {
            errorMessage = 'Unable to load alternative activities. Why not take a moment to step away from the screen?';
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'activity-error';
        errorDiv.style.cssText = `
            padding: 1rem;
            text-align: center;
            color: #6b7280;
            font-style: italic;
        `;
        errorDiv.textContent = errorMessage;
        
        if (showRetryButton) {
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Refresh Page';
            retryButton.style.cssText = `
                margin-top: 0.5rem;
                padding: 0.5rem 1rem;
                background: #4f46e5;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;
            retryButton.addEventListener('click', () => location.reload());
            
            errorDiv.appendChild(document.createElement('br'));
            errorDiv.appendChild(retryButton);
        }
        
        container.appendChild(errorDiv);
    }
}

/**
 * Initializes the timeout page with enhanced error handling and resilience.
 */
async function initializeTimeoutPage() {
    try {
        console.log('[Timeout] Initializing timeout page...');
        
        // Get URL parameters first (this should always work)
        const params = getUrlParameters();
        console.log('[Timeout] URL parameters:', params);
        
        // Display blocked site info (basic functionality, should work even if API fails)
        displayBlockedInfo(params);
        
        // Show loading state for activities
        showLoadingState();
        
        // Set up timeout for loading state
        const loadingTimeout = setTimeout(() => {
            console.warn('[Timeout] Loading timeout reached, showing fallback message');
            const container = document.getElementById('alternative-activities');
            if (container && container.classList.contains('loading')) {
                container.innerHTML = '';
                container.classList.remove('loading');
                
                const timeoutDiv = document.createElement('div');
                timeoutDiv.className = 'activity-timeout';
                timeoutDiv.style.cssText = `
                    padding: 1rem;
                    text-align: center;
                    color: #6b7280;
                    font-style: italic;
                `;
                timeoutDiv.textContent = 'Loading activities is taking longer than expected. Consider taking a break!';
                container.appendChild(timeoutDiv);
            }
        }, CONFIG.LOADING_TIMEOUT);
        
        try {
            // Fetch random timeout note with retry logic
            const randomNote = await fetchRandomTimeoutNote();
            
            // Clear loading timeout since we got a response (or final failure)
            clearTimeout(loadingTimeout);
            
            if (randomNote) {
                console.log('[Timeout] Received random note:', randomNote);
                displayAlternativeActivities([randomNote]);
            } else {
                console.log('[Timeout] No random note available or fetch failed');
                displayAlternativeActivities([]);
            }
        } catch (fetchError) {
            clearTimeout(loadingTimeout);
            throw fetchError; // Will be caught by outer try-catch
        }
        
        console.log('[Timeout] Timeout page initialization complete');
        
    } catch (error) {
        console.error('[Timeout] Error during timeout page initialization:', error);
        
        // Get URL parameters for fallback display
        const params = getUrlParameters();
        handleInitializationError(error, params);
    }
}

/**
 * Handles visibility change events to potentially retry failed operations.
 * Enhanced to retry fetching activities when page becomes visible again.
 */
function handleVisibilityChange() {
    if (!document.hidden) {
        console.log('[Timeout] Page became visible');
        
        // Check if we're in an error state and offer to retry
        const container = document.getElementById('alternative-activities');
        if (container && (
            container.querySelector('.activity-error') || 
            container.querySelector('.activity-timeout') ||
            container.querySelector('.activity-empty')
        )) {
            console.log('[Timeout] In error/empty state, attempting to reload activities');
            
            // Show loading state and retry
            showLoadingState();
            
            // Retry after a short delay
            setTimeout(async () => {
                try {
                    const randomNote = await fetchRandomTimeoutNote();
                    if (randomNote) {
                        displayAlternativeActivities([randomNote]);
                    } else {
                        displayAlternativeActivities([]);
                    }
                } catch (error) {
                    console.error('[Timeout] Retry failed:', error);
                    displayAlternativeActivities([]);
                }
            }, 1000);
        }
    }
}

/**
 * Handles shuffling to get a new random motivational note.
 * Provides visual feedback during the shuffle process.
 */
async function shuffleMotivationalNote() {
    const container = document.getElementById('alternative-activities');
    
    if (!container) {
        console.error('[Timeout] Activities container not found');
        return;
    }
    
    try {
        // Add slight fade to current content during shuffle
        container.style.opacity = '0.6';
        container.style.transition = 'opacity 0.3s ease';
        
        console.log('[Timeout] Shuffling motivational note...');
        
        // Fetch a new random note
        const randomNote = await fetchRandomTimeoutNote();
        
        // Small delay for better UX (makes the shuffle feel more intentional)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (randomNote) {
            console.log('[Timeout] Shuffled to new note:', randomNote);
            displayAlternativeActivities([randomNote]);
        } else {
            console.log('[Timeout] No new note available from shuffle');
            // Keep existing content or show fallback
            displayAlternativeActivities([]);
        }
        
        // Restore opacity
        container.style.opacity = '1';
        
    } catch (error) {
        console.error('[Timeout] Error during shuffle:', error);
        
        // Restore opacity and show fallback on error
        container.style.opacity = '1';
        displayAlternativeActivities([]);
    }
}

/**
 * Sets up event listeners for the timeout page.
 * Enhanced with additional resilience features and shuffle functionality.
 */
function setupEventListeners() {
    // Handle activity item clicks for shuffling using event delegation
    const activitiesContainer = document.getElementById('alternative-activities');
    if (activitiesContainer) {
        activitiesContainer.addEventListener('click', (event) => {
            // Check if the clicked element is an activity item
            const activityItem = event.target.closest('.activity-item');
            if (activityItem) {
                event.preventDefault();
                event.stopPropagation();
                shuffleMotivationalNote();
            }
        });
        
        // Handle keyboard events for accessibility
        activitiesContainer.addEventListener('keydown', (event) => {
            const activityItem = event.target.closest('.activity-item');
            if (activityItem && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                shuffleMotivationalNote();
            }
        });
        
        console.log('[Timeout] Activity item click and keyboard event listeners added');
    } else {
        console.warn('[Timeout] Activities container not found for event delegation');
    }
    
    // Handle page visibility changes (user switching tabs/windows)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle page focus (user coming back to this tab)
    window.addEventListener('focus', handleVisibilityChange);
    
    // Handle potential extension reload detection
    window.addEventListener('beforeunload', () => {
        console.log('[Timeout] Page unloading');
    });
    
    // Global error handler for unhandled errors
    window.addEventListener('error', (event) => {
        console.error('[Timeout] Unhandled error:', event.error);
        
        // If it's an extension context error, show reload suggestion
        if (event.error && event.error.message && 
            event.error.message.includes('Extension context invalidated')) {
            
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #fef2f2;
                border: 1px solid #fecaca;
                color: #dc2626;
                padding: 0.75rem 1rem;
                border-radius: 6px;
                font-size: 0.875rem;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            `;
            errorDiv.innerHTML = `
                Extension reloaded. <button onclick="location.reload()" style="
                    background: #dc2626; 
                    color: white; 
                    border: none; 
                    padding: 0.25rem 0.5rem; 
                    border-radius: 3px; 
                    margin-left: 0.5rem; 
                    cursor: pointer;
                ">Refresh</button>
            `;
            
            document.body.appendChild(errorDiv);
            
            // Auto-remove after 10 seconds
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 10000);
        }
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