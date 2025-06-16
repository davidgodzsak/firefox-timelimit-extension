/**
 * @file popup.js
 * @description JavaScript functionality for the toolbar popup interface.
 * Handles current page detection, form submission, and communication with background script.
 */

// DOM elements
let elements = {};

// State management
let currentPageInfo = null;
let isEditMode = false;

/**
 * Initializes DOM element references.
 * @private
 */
function initializeElements() {
  elements = {
    // Header elements
    settingsBtn: document.getElementById('settingsBtn'),
    
    // Page info elements
    currentPageInfo: document.getElementById('currentPageInfo'),
    pageUrl: document.getElementById('pageUrl'),
    pageStatus: document.getElementById('pageStatus'),
    
    // Existing limits display
    existingLimits: document.getElementById('existingLimits'),
    timeLimitDisplay: document.getElementById('timeLimitDisplay'),
    openLimitDisplay: document.getElementById('openLimitDisplay'),
    editLimitsBtn: document.getElementById('editLimitsBtn'),
    
    // Form elements
    limitsForm: document.getElementById('limitsForm'),
    formTitle: document.getElementById('formTitle'),
    urlPattern: document.getElementById('urlPattern'),
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
    loadingIndicator: document.getElementById('loadingIndicator')
  };
}

/**
 * Sets up event listeners for all interactive elements.
 * @private
 */
function setupEventListeners() {
  // Settings button
  elements.settingsBtn.addEventListener('click', openSettings);
  
  // Form submission
  elements.limitsForm.addEventListener('submit', handleFormSubmit);
  
  // Form buttons
  elements.cancelBtn.addEventListener('click', handleCancel);
  elements.closeBtn.addEventListener('click', closePopup);
  elements.editLimitsBtn.addEventListener('click', handleEditLimits);
  
  // Preset buttons
  elements.presetButtons.forEach(btn => {
    btn.addEventListener('click', handlePresetClick);
  });
  
  // Input validation
  elements.timeLimit.addEventListener('input', validateForm);
  elements.openLimit.addEventListener('input', validateForm);
  elements.urlPattern.addEventListener('input', validateForm);
}

/**
 * Shows/hides different sections of the popup UI.
 * @private
 * @param {string} section - The section to show ('loading', 'form', 'existing', 'success', 'info')
 */
function showSection(section) {
  // Hide all sections first
  elements.loadingIndicator.style.display = 'none';
  elements.limitsForm.style.display = 'none';
  elements.existingLimits.style.display = 'none';
  elements.successMessage.style.display = 'none';
  elements.infoMessage.style.display = 'none';
  elements.errorMessage.style.display = 'none';
  
  // Show the requested section
  switch (section) {
    case 'loading':
      elements.loadingIndicator.style.display = 'flex';
      break;
    case 'form':
      elements.limitsForm.style.display = 'block';
      break;
    case 'existing':
      elements.existingLimits.style.display = 'block';
      break;
    case 'success':
      elements.successMessage.style.display = 'flex';
      break;
    case 'info':
      elements.infoMessage.style.display = 'flex';
      break;
  }
}

/**
 * Displays an error message to the user.
 * @private
 * @param {string} message - The error message to display
 */
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = 'block';
}

/**
 * Hides the error message.
 * @private
 */
function hideError() {
  elements.errorMessage.style.display = 'none';
}

/**
 * Sends a message to the background script and returns the response.
 * @private
 * @param {Object} message - The message to send
 * @returns {Promise<Object>} The response from the background script
 */
async function sendMessage(message) {
  try {
    const response = await browser.runtime.sendMessage(message);
    if (!response.success) {
      throw new Error(response.error?.message || 'Unknown error occurred');
    }
    return response.data;
  } catch (error) {
    console.error('[Popup] Error sending message:', error);
    throw error;
  }
}

/**
 * Loads and displays information about the current page.
 * @async
 * @private
 */
async function loadCurrentPageInfo() {
  try {
    showSection('loading');
    
    const data = await sendMessage({
      action: 'getCurrentPageLimitInfo'
    });
    
    currentPageInfo = data;
    
    // Update page URL display
    elements.pageUrl.textContent = data.hostname || data.url;
    
    if (data.isDistractingSite && data.siteInfo) {
      // Site already has limits
      elements.pageStatus.textContent = 'Site has configured limits';
      displayExistingLimits(data.siteInfo);
      showSection('existing');
    } else {
      // Site doesn't have limits
      elements.pageStatus.textContent = 'No limits configured';
      setupNewSiteForm(data.hostname || extractHostname(data.url));
      showSection('info');
    }
    
  } catch (error) {
    console.error('[Popup] Error loading page info:', error);
    elements.pageStatus.textContent = 'Error loading page information';
    showError('Failed to load page information. Please try again.');
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
  } catch (error) {
    return url;
  }
}

/**
 * Displays existing limits for a site.
 * @private
 * @param {Object} siteInfo - The site information object
 */
function displayExistingLimits(siteInfo) {
  // Display time limit
  if (siteInfo.dailyLimitSeconds > 0) {
    const minutes = Math.round(siteInfo.dailyLimitSeconds / 60);
    elements.timeLimitDisplay.innerHTML = `
      <span>Time Limit:</span>
      <strong>${minutes} minute${minutes !== 1 ? 's' : ''}</strong>
    `;
    elements.timeLimitDisplay.style.display = 'flex';
  } else {
    elements.timeLimitDisplay.style.display = 'none';
  }
  
  // Display open limit
  if (siteInfo.dailyOpenLimit > 0) {
    elements.openLimitDisplay.innerHTML = `
      <span>Open Limit:</span>
      <strong>${siteInfo.dailyOpenLimit} open${siteInfo.dailyOpenLimit !== 1 ? 's' : ''}</strong>
    `;
    elements.openLimitDisplay.style.display = 'flex';
  } else {
    elements.openLimitDisplay.style.display = 'none';
  }
}

/**
 * Sets up the form for adding limits to a new site.
 * @private
 * @param {string} hostname - The hostname to pre-fill
 */
function setupNewSiteForm(hostname) {
  isEditMode = false;
  elements.formTitle.textContent = 'Add Limits for This Site';
  elements.submitBtn.textContent = 'Add Limits';
  elements.urlPattern.value = hostname;
  elements.timeLimit.value = '';
  elements.openLimit.value = '';
  hideError();
}

/**
 * Sets up the form for editing existing limits.
 * @private
 * @param {Object} siteInfo - The existing site information
 */
function setupEditForm(siteInfo) {
  isEditMode = true;
  elements.formTitle.textContent = 'Edit Limits';
  elements.submitBtn.textContent = 'Update Limits';
  elements.urlPattern.value = siteInfo.urlPattern;
  elements.timeLimit.value = siteInfo.dailyLimitSeconds > 0 ? Math.round(siteInfo.dailyLimitSeconds / 60) : '';
  elements.openLimit.value = siteInfo.dailyOpenLimit || '';
  hideError();
}

/**
 * Validates the form and updates submit button state.
 * @private
 */
function validateForm() {
  const urlPattern = elements.urlPattern.value.trim();
  const timeLimit = elements.timeLimit.value;
  const openLimit = elements.openLimit.value;
  
  // At least one limit must be specified
  const hasTimeLimit = timeLimit && parseInt(timeLimit) > 0;
  const hasOpenLimit = openLimit && parseInt(openLimit) > 0;
  const hasUrlPattern = urlPattern.length > 0;
  
  const isValid = hasUrlPattern && (hasTimeLimit || hasOpenLimit);
  
  elements.submitBtn.disabled = !isValid;
  
  if (!isValid && (timeLimit || openLimit || urlPattern)) {
    if (!hasUrlPattern) {
      showError('Please enter a URL pattern');
    } else if (!hasTimeLimit && !hasOpenLimit) {
      showError('Please specify at least one limit (time or opens)');
    } else {
      hideError();
    }
  } else {
    hideError();
  }
}

/**
 * Handles form submission.
 * @private
 * @param {Event} event - The form submit event
 */
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const urlPattern = elements.urlPattern.value.trim();
  const timeLimit = elements.timeLimit.value;
  const openLimit = elements.openLimit.value;
  
  // Validate inputs
  if (!urlPattern) {
    showError('Please enter a URL pattern');
    return;
  }
  
  const timeLimitSeconds = timeLimit ? parseInt(timeLimit) * 60 : 0;
  const openLimitCount = openLimit ? parseInt(openLimit) : 0;
  
  if (timeLimitSeconds <= 0 && openLimitCount <= 0) {
    showError('Please specify at least one limit');
    return;
  }
  
  try {
    elements.submitBtn.disabled = true;
    elements.submitBtn.textContent = 'Saving...';
    
    const payload = {
      urlPattern: urlPattern,
      dailyLimitSeconds: timeLimitSeconds
    };
    
    if (openLimitCount > 0) {
      payload.dailyOpenLimit = openLimitCount;
    }
    
    if (isEditMode && currentPageInfo?.siteInfo?.id) {
      // Update existing site
      await sendMessage({
        action: 'updateDistractingSite',
        payload: {
          id: currentPageInfo.siteInfo.id,
          updates: payload
        }
      });
    } else {
      // Add new site
      await sendMessage({
        action: 'addQuickLimit',
        payload: payload
      });
    }
    
    showSection('success');
    
  } catch (error) {
    console.error('[Popup] Error submitting form:', error);
    showError(error.message || 'Failed to save limits. Please try again.');
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = isEditMode ? 'Update Limits' : 'Add Limits';
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
 * Handles the edit limits button click.
 * @private
 */
function handleEditLimits() {
  if (currentPageInfo?.siteInfo) {
    setupEditForm(currentPageInfo.siteInfo);
    showSection('form');
  }
}

/**
 * Handles the cancel button click.
 * @private
 */
function handleCancel() {
  if (currentPageInfo?.isDistractingSite) {
    showSection('existing');
  } else {
    showSection('info');
  }
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
    
    // Load current page information
    await loadCurrentPageInfo();
    
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