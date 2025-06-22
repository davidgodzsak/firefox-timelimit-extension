/**
 * @file popup.js
 * @description JavaScript functionality for the toolbar popup interface.
 * Handles current page detection, form submission, and communication with background script.
 */

// DOM elements
let elements = {};

// State management
let currentPageInfo = null;

// Performance optimization: Cache frequently accessed data
let _dataCache = {
  currentPageData: null,
  cacheExpiry: 0,
  CACHE_TTL: 5000, // 5 seconds TTL for popup data
};

// Debounce timers for form validation
let _validationTimers = {
  urlPattern: null,
  timeLimit: null,
  openLimit: null,
};

// Performance configuration
const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 300, // ms for form validation debouncing
  DOM_BATCH_SIZE: 5, // Batch DOM operations for better performance
  ERROR_DISPLAY_TIMEOUT: 5000, // Auto-hide errors after 5 seconds
  REFRESH_INTERVAL: 10000, // Auto-refresh every 10 seconds when popup is visible
};

// Real-time update management
let _refreshTimer = null;
let _isVisible = false;

/**
 * Initializes DOM element references with error handling.
 * @private
 */
function initializeElements() {
  try {
    elements = {
      // Header elements
      settingsBtn: document.getElementById('settingsBtn'),

      // Page info elements
      currentPageInfo: document.getElementById('currentPageInfo'),
      pageUrl: document.getElementById('pageUrl'),
      pageStatus: document.getElementById('pageStatus'),

      // Existing limits display - updated for new structure
      existingLimits: document.getElementById('existingLimits'),
      timeLimitDisplay: document.getElementById('timeLimitDisplay'),
      openLimitDisplay: document.getElementById('openLimitDisplay'),

      // Progress bars
      timeProgress: document.getElementById('timeProgress'),
      timeProgressValue: document.getElementById('timeProgressValue'),
      timeProgressFill: document.getElementById('timeProgressFill'),
      openProgress: document.getElementById('openProgress'),
      openProgressValue: document.getElementById('openProgressValue'),
      openProgressFill: document.getElementById('openProgressFill'),

      // Form elements - updated for new structure
      limitsFormSection: document.getElementById('limitsFormSection'),
      limitsForm: document.getElementById('limitsForm'),
      formTitle: document.getElementById('formTitle'),
      // QA FIX: Removed urlPattern - auto-detect from current tab
      timeLimit: document.getElementById('timeLimit'),
      openLimit: document.getElementById('openLimit'),
      errorMessage: document.getElementById('errorMessage'),
      submitBtn: document.getElementById('submitBtn'),
      cancelBtn: document.getElementById('cancelBtn'),

      // Preset buttons
      presetButtons: document.querySelectorAll('.btn-preset'),

      // Messages
      successMessage: document.getElementById('successMessage'),
      infoMessage: document.getElementById('infoMessage'),
      closeBtn: document.getElementById('closeBtn'),

      // Loading
      loadingIndicator: document.getElementById('loadingIndicator'),
    };

    // Validate that all critical elements exist
    const criticalElements = ['loadingIndicator', 'limitsForm', 'errorMessage'];
    const missingElements = criticalElements.filter((id) => !elements[id]);

    if (missingElements.length > 0) {
      throw new Error(
        `Critical DOM elements missing: ${missingElements.join(', ')}`
      );
    }
  } catch (error) {
    console.error('[Popup] Error initializing DOM elements:', error);
    // Show fallback error message
    const fallbackError = document.createElement('div');
    fallbackError.style.cssText =
      'color: red; padding: 10px; text-align: center;';
    fallbackError.textContent =
      'Error loading popup interface. Please try again.';
    document.body.appendChild(fallbackError);
    throw error;
  }
}

/**
 * Sets up event listeners for all interactive elements with performance optimizations.
 * @private
 */
function setupEventListeners() {
  try {
    // Settings button
    if (elements.settingsBtn) {
      elements.settingsBtn.addEventListener('click', openSettings);
    }

    // Form submission
    if (elements.limitsForm) {
      elements.limitsForm.addEventListener('submit', handleFormSubmit);
    }

    // Form buttons
    if (elements.cancelBtn) {
      elements.cancelBtn.addEventListener('click', handleCancel);
    }
    if (elements.closeBtn) {
      elements.closeBtn.addEventListener('click', closePopup);
    }

    // Preset buttons with event delegation for better performance
    if (elements.presetButtons.length > 0) {
      elements.presetButtons.forEach((btn) => {
        btn.addEventListener('click', handlePresetClick);
      });
    }

    // Debounced input validation for better performance
    if (elements.timeLimit) {
      elements.timeLimit.addEventListener('input', (e) => {
        debouncedValidation('timeLimit', e.target.value);
      });
    }
    if (elements.openLimit) {
      elements.openLimit.addEventListener('input', (e) => {
        debouncedValidation('openLimit', e.target.value);
      });
    }
    // QA FIX: Removed urlPattern input validation - auto-detect from current tab

    // Keyboard shortcuts for better UX
    document.addEventListener('keydown', handleKeyboardShortcuts);
  } catch (error) {
    console.error('[Popup] Error setting up event listeners:', error);
  }
}

/**
 * Debounced validation function to improve performance during typing.
 * @private
 * @param {string} field - The field being validated
 * @param {string} value - The current field value
 */
function debouncedValidation(field, _value) {
  // Clear existing timer
  if (_validationTimers[field]) {
    clearTimeout(_validationTimers[field]);
  }

  // Set new timer
  _validationTimers[field] = setTimeout(() => {
    validateForm();
    _validationTimers[field] = null;
  }, PERFORMANCE_CONFIG.DEBOUNCE_DELAY);
}

/**
 * Shows/hides different sections of the popup UI with smooth transitions.
 * Updated for new HTML structure.
 * @private
 * @param {string} section - The section to show ('loading', 'form', 'existing', 'success', 'info')
 */
function showSection(section) {
  // Updated section elements for new structure
  const sectionsToHide = [
    'loadingIndicator',
    'limitsFormSection',
    'existingLimits',
    'successMessage',
    'infoMessage',
    'errorMessage',
  ];

  // Use requestAnimationFrame for smooth UI updates
  requestAnimationFrame(() => {
    // Hide all sections first
    sectionsToHide.forEach((elementKey) => {
      if (elements[elementKey]) {
        elements[elementKey].style.display = 'none';
      }
    });

    // Show the requested section
    switch (section) {
      case 'loading':
        if (elements.loadingIndicator) {
          elements.loadingIndicator.style.display = 'block';
        }
        break;
      case 'form':
        if (elements.limitsFormSection) {
          elements.limitsFormSection.style.display = 'block';
        }
        break;
      case 'existing':
        if (elements.existingLimits) {
          elements.existingLimits.style.display = 'block';
        }
        break;
      case 'success':
        if (elements.successMessage) {
          elements.successMessage.style.display = 'block';
        }
        break;
      case 'info':
        if (elements.infoMessage) {
          elements.infoMessage.style.display = 'block';
        }
        break;
    }
  });
}

/**
 * Displays an error message to the user with auto-hide functionality.
 * @private
 * @param {string} message - The error message to display
 */
function showError(message) {
  if (!elements.errorMessage) return;

  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = 'block';

  // Auto-hide error after timeout for better UX
  setTimeout(() => {
    hideError();
  }, PERFORMANCE_CONFIG.ERROR_DISPLAY_TIMEOUT);
}

/**
 * Hides the error message.
 * @private
 */
function hideError() {
  if (elements.errorMessage) {
    elements.errorMessage.style.display = 'none';
  }
}

/**
 * Optimized message sending with retry logic and caching.
 * @private
 * @param {Object} message - The message to send
 * @param {boolean} useCache - Whether to check cache first
 * @returns {Promise<Object>} The response from the background script
 */
async function sendMessage(message, useCache = false) {
  try {
    // Check cache for getCurrentPageLimitInfo requests
    if (useCache && message.action === 'getCurrentPageLimitInfo') {
      if (_dataCache.currentPageData && Date.now() < _dataCache.cacheExpiry) {
        console.log('[Popup] Using cached page data');
        return _dataCache.currentPageData;
      }
    }

    const response = await browser.runtime.sendMessage(message);
    if (!response.success) {
      throw new Error(response.error?.message || 'Unknown error occurred');
    }

    // Cache the response for getCurrentPageLimitInfo
    if (message.action === 'getCurrentPageLimitInfo') {
      _dataCache.currentPageData = response.data;
      _dataCache.cacheExpiry = Date.now() + _dataCache.CACHE_TTL;
    }

    return response.data;
  } catch (error) {
    console.error('[Popup] Error sending message:', error);

    // Clear cache on errors to force refresh
    if (message.action === 'getCurrentPageLimitInfo') {
      _dataCache.currentPageData = null;
      _dataCache.cacheExpiry = 0;
    }

    throw error;
  }
}

/**
 * Loads and displays information about the current page with caching.
 * @async
 * @private
 */
async function loadCurrentPageInfo() {
  try {
    showSection('loading');

    // Use cached data if available and fresh
    const data = await sendMessage(
      {
        action: 'getCurrentPageLimitInfo',
      },
      true
    );

    currentPageInfo = data;

    // Batch DOM updates for better performance
    requestAnimationFrame(() => {
      // Update page URL display
      if (elements.pageUrl) {
        elements.pageUrl.textContent = data.hostname || data.url;
      }

      if (data.isDistractingSite && data.siteInfo) {
        // QA FIX: Show cleaner status message since progress bars provide sufficient info
        if (elements.pageStatus) {
          elements.pageStatus.textContent = `${data.hostname || extractHostname(data.url)} - Active limits`;
        }
        displayExistingLimits(data.siteInfo);
        showSection('existing');
      } else {
        // QA FIX: Show cleaner status for unconfigured sites
        if (elements.pageStatus) {
          elements.pageStatus.textContent = `${data.hostname || extractHostname(data.url)} - No limits configured`;
        }
        setupNewSiteForm(data.hostname || extractHostname(data.url));
        showSection('form');
      }
    });
  } catch (error) {
    console.error('[Popup] Error loading page info:', error);

    // Handle different error types appropriately
    let errorMessage = 'Failed to load page information. Please try again.';

    if (
      error.message.includes('Extension context invalidated') ||
      error.message.includes('Extension was reloaded')
    ) {
      errorMessage =
        'Extension was reloaded. Please close and reopen this popup.';
    } else if (error.message.includes('not available')) {
      errorMessage = 'Unable to access current page. Please try again.';
    }

    if (elements.pageStatus) {
      elements.pageStatus.textContent = 'Error loading page information';
    }
    showError(errorMessage);
  }
}

/**
 * Extracts hostname from a URL string.
 * @private
 * @param {string} url - The URL to extract hostname from
 * @returns {string} The hostname
 */
function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Displays existing limits with enhanced usage data and functional progress bars.
 * Updated to match new HTML structure and show real usage data.
 * @private
 * @param {Object} siteInfo - The site information containing limits and usage
 */
function displayExistingLimits(siteInfo) {
  console.log('[Popup] Displaying existing limits:', siteInfo);

  // Display time limit and progress
  if (siteInfo.dailyLimitSeconds > 0) {
    const limitMinutes = Math.round(siteInfo.dailyLimitSeconds / 60);
    const usedMinutes = Math.round((siteInfo.todaySeconds || 0) / 60);
    const percentage = Math.min((usedMinutes / limitMinutes) * 100, 100);

    // Update time limit display
    if (elements.timeLimitDisplay) {
      elements.timeLimitDisplay.innerHTML = `
        <span>Daily Time Limit:</span>
        <strong>${limitMinutes} minute${limitMinutes !== 1 ? 's' : ''}</strong>
      `;
      elements.timeLimitDisplay.style.display = 'flex';
    }

    // Show time progress with enhanced styling
    if (
      elements.timeProgress &&
      elements.timeProgressValue &&
      elements.timeProgressFill
    ) {
      elements.timeProgressValue.textContent = `${usedMinutes} / ${limitMinutes} min`;
      elements.timeProgressFill.style.width = `${percentage}%`;

      // Add visual feedback for approaching/exceeding limits
      if (percentage >= 100) {
        elements.timeProgressFill.style.background = 'var(--accent-error)';
      } else if (percentage >= 80) {
        elements.timeProgressFill.style.background = 'var(--accent-warning)';
      } else {
        elements.timeProgressFill.style.background =
          'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))';
      }

      elements.timeProgress.style.display = 'block';
    }
  } else {
    if (elements.timeLimitDisplay) {
      elements.timeLimitDisplay.style.display = 'none';
    }
    if (elements.timeProgress) {
      elements.timeProgress.style.display = 'none';
    }
  }

  // Display open limit and progress
  if (siteInfo.dailyOpenLimit > 0) {
    const usedOpens = siteInfo.todayOpenCount || 0;
    const percentage = Math.min(
      (usedOpens / siteInfo.dailyOpenLimit) * 100,
      100
    );

    // Update open limit display
    if (elements.openLimitDisplay) {
      elements.openLimitDisplay.innerHTML = `
        <span>Daily Open Limit:</span>
        <strong>${siteInfo.dailyOpenLimit} open${siteInfo.dailyOpenLimit !== 1 ? 's' : ''}</strong>
      `;
      elements.openLimitDisplay.style.display = 'flex';
    }

    // Show open progress with enhanced styling
    if (
      elements.openProgress &&
      elements.openProgressValue &&
      elements.openProgressFill
    ) {
      elements.openProgressValue.textContent = `${usedOpens} / ${siteInfo.dailyOpenLimit}`;
      elements.openProgressFill.style.width = `${percentage}%`;

      // Add visual feedback for approaching/exceeding limits
      if (percentage >= 100) {
        elements.openProgressFill.style.background = 'var(--accent-error)';
      } else if (percentage >= 80) {
        elements.openProgressFill.style.background = 'var(--accent-warning)';
      } else {
        elements.openProgressFill.style.background =
          'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))';
      }

      elements.openProgress.style.display = 'block';
    }
  } else {
    if (elements.openLimitDisplay) {
      elements.openLimitDisplay.style.display = 'none';
    }
    if (elements.openProgress) {
      elements.openProgress.style.display = 'none';
    }
  }
}

/**
 * Sets up the form for adding limits to a new site.
 * Updated to match new HTML structure with icons.
 * @private
 * @param {string} hostname - The hostname to pre-fill
 */
function setupNewSiteForm(hostname) {
  // QA FIX: Update form title to show the specific site name being configured
  if (elements.formTitle) {
    elements.formTitle.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      Add Limits for ${hostname || 'This Site'}
    `;
  }

  // Update submit button with icon
  if (elements.submitBtn) {
    elements.submitBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
      Add Limits
    `;
  }

  // QA FIX: Store hostname for form submission (no longer pre-filling input)
  // Store the hostname in a data attribute or variable for later use
  if (elements.limitsForm) {
    elements.limitsForm.dataset.hostname = hostname || '';
  }

  // Clear form fields
  if (elements.timeLimit) elements.timeLimit.value = '';
  if (elements.openLimit) elements.openLimit.value = '';

  hideError();
}

/**
 * Enhanced form validation with improved error messaging and performance.
 * @private
 */
function validateForm() {
  if (!elements.timeLimit || !elements.openLimit || !elements.submitBtn) {
    return;
  }

  const timeValue = parseInt(elements.timeLimit.value);
  const openValue = parseInt(elements.openLimit.value);

  // Clear any existing validation styles
  requestAnimationFrame(() => {
    [elements.timeLimit, elements.openLimit].forEach((input) => {
      if (input) {
        input.classList.remove('error', 'valid');
      }
    });
  });

  let isValid = true;
  let errorMessages = [];

  // QA FIX: Removed URL pattern validation - auto-detect from current tab

  // At least one limit must be specified
  const hasTimeLimit = !isNaN(timeValue) && timeValue > 0;
  const hasOpenLimit = !isNaN(openValue) && openValue > 0;

  if (!hasTimeLimit && !hasOpenLimit) {
    errorMessages.push('At least one limit (time or opens) must be specified');
    isValid = false;
  }

  // Time limit validation
  if (hasTimeLimit) {
    if (timeValue < 1 || timeValue > 1440) {
      // 1 minute to 24 hours
      errorMessages.push('Time limit must be between 1 and 1440 minutes');
      if (elements.timeLimit) elements.timeLimit.classList.add('error');
      isValid = false;
    } else {
      if (elements.timeLimit) elements.timeLimit.classList.add('valid');
    }
  }

  // Open limit validation
  if (hasOpenLimit) {
    if (openValue < 1 || openValue > 100) {
      errorMessages.push('Open limit must be between 1 and 100');
      if (elements.openLimit) elements.openLimit.classList.add('error');
      isValid = false;
    } else {
      if (elements.openLimit) elements.openLimit.classList.add('valid');
    }
  }

  // Update submit button state
  elements.submitBtn.disabled = !isValid;

  // Show validation errors
  if (errorMessages.length > 0) {
    showError(errorMessages[0]); // Show first error
  } else {
    hideError();
  }

  return isValid;
}

/**
 * Handles form submission with enhanced error handling.
 * @private
 * @param {Event} event - The form submit event
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  // QA FIX: Get hostname from stored data attribute instead of input field
  const urlPattern = elements.limitsForm.dataset.hostname;
  const timeLimit = elements.timeLimit.value;
  const openLimit = elements.openLimit.value;

  // Validate inputs
  if (!urlPattern) {
    showError('Unable to detect current site. Please try again.');
    return;
  }

  const timeLimitSeconds = timeLimit ? parseInt(timeLimit) * 60 : 0;
  const openLimitCount = openLimit ? parseInt(openLimit) : 0;

  if (timeLimitSeconds <= 0 && openLimitCount <= 0) {
    showError('Please specify at least one limit');
    return;
  }

  try {
    // Update button state
    elements.submitBtn.disabled = true;
    elements.submitBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      Saving...
    `;

    const payload = {
      urlPattern: urlPattern,
      dailyLimitSeconds: timeLimitSeconds,
    };

    if (openLimitCount > 0) {
      payload.dailyOpenLimit = openLimitCount;
    }

    await sendMessage({
      action: 'addQuickLimit',
      payload: payload,
    });

    // Clear cache to force refresh when reopening
    _dataCache.currentPageData = null;
    _dataCache.cacheExpiry = 0;

    // Refresh current data to show updated limits immediately
    setTimeout(async () => {
      await refreshCurrentData();
    }, 200);

    showSection('success');
  } catch (error) {
    console.error('[Popup] Error submitting form:', error);
    showError(error.message || 'Failed to save limits. Please try again.');

    // Restore button state
    elements.submitBtn.disabled = false;
    elements.submitBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
      Add Limits
    `;
  }
}

/**
 * Handles preset button clicks.
 * @private
 * @param {Event} event - The click event
 */
function handlePresetClick(event) {
  const button = event.target;
  const timeMinutes = button.dataset.time;
  const opens = button.dataset.opens;

  if (timeMinutes) {
    elements.timeLimit.value = timeMinutes;
  }
  if (opens) {
    elements.openLimit.value = opens;
  }

  validateForm();
}

/**
 * Handles the cancel button click.
 * @private
 */
function handleCancel() {
  closePopup();
}

/**
 * Opens the settings page.
 * @private
 */
async function openSettings() {
  try {
    await browser.runtime.openOptionsPage();
    closePopup();
  } catch (error) {
    console.error('[Popup] Error opening settings:', error);
    showError('Failed to open settings page');
  }
}

/**
 * Closes the popup window.
 * @private
 */
function closePopup() {
  window.close();
}

/**
 * Handles keyboard shortcuts.
 * @private
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyboardShortcuts(event) {
  // Escape key to close popup
  if (event.key === 'Escape') {
    closePopup();
  }

  // Enter key to submit form when focused on form elements
  if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
    const form = event.target.closest('form');
    if (form && !elements.submitBtn.disabled) {
      event.preventDefault();
      handleFormSubmit(event);
    }
  }
}

/**
 * Initializes the popup interface.
 * @async
 */
async function initializePopup() {
  try {
    console.log('[Popup] Initializing popup...');

    // Initialize DOM elements
    initializeElements();

    // Set up event listeners
    setupEventListeners();

    // Set up keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Track popup visibility for real-time updates
    _isVisible = true;

    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      _isVisible = !document.hidden;
      if (_isVisible) {
        // Refresh data when popup becomes visible
        setTimeout(refreshCurrentData, 100);
      }
    });

    // Handle window focus/blur for better real-time updates
    window.addEventListener('focus', () => {
      _isVisible = true;
      setTimeout(refreshCurrentData, 100);
    });

    window.addEventListener('blur', () => {
      _isVisible = false;
    });

    // Clean up when popup is closed
    window.addEventListener('beforeunload', () => {
      stopAutoRefresh();
    });

    // Listen for broadcast messages from background script
    browser.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      if (message.type === 'broadcastUpdate') {
        handleBroadcastUpdate(message);
      }
      // Don't return anything for broadcast messages to avoid interfering with other listeners
    });

    // Load current page information
    await loadCurrentPageInfo();

    // Start auto-refresh for real-time updates
    startAutoRefresh();

    console.log('[Popup] Popup initialized successfully');
  } catch (error) {
    console.error('[Popup] Error initializing popup:', error);
    showError('Failed to initialize popup. Please try refreshing.');
  }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

/**
 * Refreshes current page data without full reload for real-time updates.
 * @async
 * @private
 */
async function refreshCurrentData() {
  if (!currentPageInfo || !currentPageInfo.isDistractingSite) {
    return; // No point refreshing if not a distracting site
  }

  try {
    const refreshData = await sendMessage({
      action: 'refreshCurrentPageData',
    });

    if (
      refreshData.isDistractingSite &&
      refreshData.site &&
      refreshData.usage
    ) {
      // Update current page info with fresh usage data
      currentPageInfo.siteInfo = {
        ...currentPageInfo.siteInfo,
        todaySeconds: refreshData.usage.timeSpentSeconds,
        todayOpenCount: refreshData.usage.opens,
        lastUpdated: refreshData.usage.lastUpdated,
      };

      // Update the display with fresh data
      displayExistingLimits(currentPageInfo.siteInfo);

      console.log('[Popup] Refreshed usage data:', refreshData.usage);
    }
  } catch (error) {
    console.warn('[Popup] Error refreshing data:', error);
    // Don't show error to user for background refreshes
  }
}

/**
 * Starts automatic refresh timer for real-time updates.
 * @private
 */
function startAutoRefresh() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
  }

  _refreshTimer = setInterval(async () => {
    if (_isVisible && currentPageInfo && currentPageInfo.isDistractingSite) {
      await refreshCurrentData();
    }
  }, PERFORMANCE_CONFIG.REFRESH_INTERVAL);

  console.log('[Popup] Auto-refresh started');
}

/**
 * Stops automatic refresh timer.
 * @private
 */
function stopAutoRefresh() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
  console.log('[Popup] Auto-refresh stopped');
}

/**
 * Handles broadcast messages from background script for real-time updates.
 * @private
 * @param {Object} message - The broadcast message
 */
function handleBroadcastUpdate(message) {
  if (!message || message.type !== 'broadcastUpdate') {
    return;
  }

  console.log(
    '[Popup] Received broadcast update:',
    message.updateType,
    message.data
  );

  // Only handle updates if we're visible and have page info
  if (!_isVisible || !currentPageInfo) {
    return;
  }

  switch (message.updateType) {
    case 'siteUpdated':
      // If the updated site matches our current page, refresh our data
      if (
        currentPageInfo.isDistractingSite &&
        currentPageInfo.siteInfo &&
        message.data.site &&
        currentPageInfo.siteInfo.id === message.data.site.id
      ) {
        console.log('[Popup] Current site was updated, refreshing display');
        setTimeout(refreshCurrentData, 100);
      }
      break;

    case 'siteDeleted':
      // If the deleted site matches our current page, refresh to show it's no longer limited
      if (
        currentPageInfo.isDistractingSite &&
        currentPageInfo.siteInfo &&
        message.data.siteId === currentPageInfo.siteInfo.id
      ) {
        console.log('[Popup] Current site was deleted, reloading page info');
        setTimeout(loadCurrentPageInfo, 100);
      }
      break;

    case 'usageUpdated':
      // If usage was updated for our current site, refresh the progress bars
      if (
        currentPageInfo.isDistractingSite &&
        currentPageInfo.siteInfo &&
        message.data.siteId === currentPageInfo.siteInfo.id
      ) {
        console.log(
          '[Popup] Usage updated for current site, refreshing progress'
        );
        setTimeout(refreshCurrentData, 50); // Faster refresh for usage updates
      }
      break;

    case 'siteAdded':
    case 'quickLimitAdded':
      // If a new site was added and matches our current page, reload to show limits
      if (!currentPageInfo.isDistractingSite && message.data.site) {
        const currentHostname = extractHostname(currentPageInfo.url || '');
        if (
          currentHostname &&
          message.data.site.urlPattern &&
          currentHostname.includes(message.data.site.urlPattern)
        ) {
          console.log('[Popup] New limit added for current page, reloading');
          setTimeout(loadCurrentPageInfo, 100);
        }
      }
      break;
  }
}
