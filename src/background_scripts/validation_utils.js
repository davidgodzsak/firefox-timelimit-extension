/**
 * @file validation_utils.js
 * @description Centralized validation utilities for the Firefox Distraction Limiter extension.
 * Provides robust input validation, URL pattern validation, and error categorization
 * to enhance error handling consistency across all modules.
 *
 * This module helps ensure:
 * - Consistent validation patterns across the extension
 * - Better error categorization and handling
 * - Enhanced security through input sanitization
 * - Improved user feedback with meaningful error messages
 */

/**
 * Error types for categorizing different kinds of validation failures
 */
export const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  STORAGE: 'STORAGE_ERROR',
  NETWORK: 'NETWORK_ERROR',
  EXTENSION_CONTEXT: 'EXTENSION_CONTEXT_ERROR',
  BROWSER_API: 'BROWSER_API_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

/**
 * Storage quota limits for different types of data
 */
const STORAGE_LIMITS = {
  MAX_SITES: 500,
  MAX_NOTES: 1000,
  MAX_URL_LENGTH: 2000,
  MAX_NOTE_LENGTH: 1000,
  MAX_DAILY_LIMIT_SECONDS: 86400, // 24 hours
  MAX_DAILY_OPEN_LIMIT: 1000, // Maximum opens per day
};

/**
 * Validates a URL pattern for distracting sites.
 * Provides more robust URL validation than basic checks.
 *
 * @param {string} urlPattern - The URL pattern to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the URL pattern is valid
 * @returns {string} returns.error - Error message if invalid
 * @returns {string} returns.normalizedPattern - Normalized URL pattern if valid
 */
export function validateUrlPattern(urlPattern) {
  if (!urlPattern || typeof urlPattern !== 'string') {
    return {
      isValid: false,
      error: 'URL pattern must be a non-empty string',
      normalizedPattern: null,
    };
  }

  const trimmed = urlPattern.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'URL pattern cannot be empty',
      normalizedPattern: null,
    };
  }

  if (trimmed.length > STORAGE_LIMITS.MAX_URL_LENGTH) {
    return {
      isValid: false,
      error: `URL pattern too long (max ${STORAGE_LIMITS.MAX_URL_LENGTH} characters)`,
      normalizedPattern: null,
    };
  }

  // Remove protocol if present for normalization
  let normalized = trimmed.toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');

  // Basic hostname validation
  const hostnameRegex = /^[a-z0-9.-]+[a-z0-9]$/;
  if (!hostnameRegex.test(normalized.split('/')[0])) {
    return {
      isValid: false,
      error:
        'Invalid URL format. Please enter a valid domain (e.g., example.com)',
      normalizedPattern: null,
    };
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    'javascript:',
    'data:',
    'file:',
    'chrome:',
    'moz-extension:',
  ];
  if (
    dangerousPatterns.some((pattern) => trimmed.toLowerCase().includes(pattern))
  ) {
    return {
      isValid: false,
      error: 'Invalid URL pattern contains restricted protocol',
      normalizedPattern: null,
    };
  }

  return {
    isValid: true,
    error: null,
    normalizedPattern: normalized,
  };
}

/**
 * Validates a daily time limit in seconds.
 *
 * @param {number} limitSeconds - The time limit to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the limit is valid
 * @returns {string} returns.error - Error message if invalid
 */
export function validateDailyTimeLimit(limitSeconds) {
  if (typeof limitSeconds !== 'number' || isNaN(limitSeconds)) {
    return {
      isValid: false,
      error: 'Time limit must be a valid number',
    };
  }

  if (limitSeconds <= 0) {
    return {
      isValid: false,
      error: 'Time limit must be greater than 0',
    };
  }

  if (limitSeconds > STORAGE_LIMITS.MAX_DAILY_LIMIT_SECONDS) {
    return {
      isValid: false,
      error: 'Time limit cannot exceed 24 hours',
    };
  }

  return {
    isValid: true,
    error: null,
  };
}

/**
 * Validates a timeout note text.
 *
 * @param {string} noteText - The note text to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the note is valid
 * @returns {string} returns.error - Error message if invalid
 * @returns {string} returns.sanitizedText - Sanitized note text if valid
 */
export function validateNoteText(noteText) {
  if (!noteText || typeof noteText !== 'string') {
    return {
      isValid: false,
      error: 'Note text must be a non-empty string',
      sanitizedText: null,
    };
  }

  const trimmed = noteText.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Note text cannot be empty',
      sanitizedText: null,
    };
  }

  if (trimmed.length > STORAGE_LIMITS.MAX_NOTE_LENGTH) {
    return {
      isValid: false,
      error: `Note text too long (max ${STORAGE_LIMITS.MAX_NOTE_LENGTH} characters)`,
      sanitizedText: null,
    };
  }

  // Basic HTML escape for security
  const sanitized = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return {
    isValid: true,
    error: null,
    sanitizedText: sanitized,
  };
}

/**
 * Validates storage limits to prevent quota exceeded errors.
 *
 * @param {string} dataType - Type of data ('sites' or 'notes')
 * @param {number} currentCount - Current count of items
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether adding more items is allowed
 * @returns {string} returns.error - Error message if limit would be exceeded
 */
export function validateStorageLimits(dataType, currentCount) {
  const limits = {
    sites: STORAGE_LIMITS.MAX_SITES,
    notes: STORAGE_LIMITS.MAX_NOTES,
  };

  const maxLimit = limits[dataType];
  if (!maxLimit) {
    return {
      isValid: false,
      error: 'Unknown data type for storage validation',
    };
  }

  if (currentCount >= maxLimit) {
    return {
      isValid: false,
      error: `Maximum number of ${dataType} reached (${maxLimit})`,
    };
  }

  return {
    isValid: true,
    error: null,
  };
}

/**
 * Categorizes errors for better handling and user feedback.
 *
 * @param {Error} error - The error to categorize
 * @returns {Object} Categorized error information
 * @returns {string} returns.type - Error type from ERROR_TYPES
 * @returns {string} returns.userMessage - User-friendly error message
 * @returns {boolean} returns.isRetryable - Whether the operation can be retried
 */
export function categorizeError(error) {
  if (!error) {
    return {
      type: ERROR_TYPES.UNKNOWN,
      userMessage: 'An unknown error occurred',
      isRetryable: false,
    };
  }

  const message = error.message || error.toString();
  const lowerMessage = message.toLowerCase();

  // Extension context errors (common during development/reloading)
  if (
    lowerMessage.includes('extension context invalidated') ||
    lowerMessage.includes('message port closed') ||
    lowerMessage.includes('receiving end does not exist')
  ) {
    return {
      type: ERROR_TYPES.EXTENSION_CONTEXT,
      userMessage: 'Extension was reloaded. Please refresh this page.',
      isRetryable: false,
    };
  }

  // Storage quota errors
  if (
    lowerMessage.includes('quota exceeded') ||
    lowerMessage.includes('storage full') ||
    lowerMessage.includes('exceeded storage quota')
  ) {
    return {
      type: ERROR_TYPES.STORAGE,
      userMessage:
        'Storage limit reached. Please remove some items and try again.',
      isRetryable: false,
    };
  }

  // Network/connectivity errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('timeout')
  ) {
    return {
      type: ERROR_TYPES.NETWORK,
      userMessage:
        'Connection error. Please check your internet connection and try again.',
      isRetryable: true,
    };
  }

  // Browser API errors
  if (
    lowerMessage.includes('tabs') ||
    lowerMessage.includes('windows') ||
    lowerMessage.includes('storage') ||
    lowerMessage.includes('runtime')
  ) {
    return {
      type: ERROR_TYPES.BROWSER_API,
      userMessage:
        'Browser API error. Please try again or restart the browser.',
      isRetryable: true,
    };
  }

  // Validation errors (usually from our own validation functions)
  if (error.name === 'ValidationError' || lowerMessage.includes('invalid')) {
    return {
      type: ERROR_TYPES.VALIDATION,
      userMessage: message, // Use original message for validation errors
      isRetryable: false,
    };
  }

  // Default/unknown errors
  return {
    type: ERROR_TYPES.UNKNOWN,
    userMessage: 'An unexpected error occurred. Please try again.',
    isRetryable: true,
  };
}

/**
 * Safely executes a browser API call with enhanced error handling.
 *
 * @param {Function} apiCall - The browser API function to call
 * @param {Array} args - Arguments to pass to the API function
 * @param {string} operationName - Name of the operation for logging
 * @returns {Promise<Object>} Result object with success/error information
 */
export async function safeBrowserApiCall(
  apiCall,
  args = [],
  operationName = 'Browser API call'
) {
  try {
    const result = await apiCall(...args);
    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    const categorized = categorizeError(error);
    console.error(`[ValidationUtils] ${operationName} failed:`, {
      error: error.message,
      type: categorized.type,
      isRetryable: categorized.isRetryable,
    });

    return {
      success: false,
      data: null,
      error: {
        message: categorized.userMessage,
        type: categorized.type,
        isRetryable: categorized.isRetryable,
        originalError: error.message,
      },
    };
  }
}

/**
 * Creates a validation error with consistent structure.
 *
 * @param {string} message - The error message
 * @param {string} field - The field that failed validation
 * @returns {Error} Validation error object
 */
export function createValidationError(message, field = null) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.field = field;
  return error;
}

/**
 * Validates that all required fields are present in an object.
 *
 * @param {Object} obj - The object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether all required fields are present
 * @returns {string} returns.error - Error message if validation fails
 * @returns {string} returns.missingField - The first missing field name
 */
export function validateRequiredFields(obj, requiredFields) {
  if (!obj || typeof obj !== 'object') {
    return {
      isValid: false,
      error: 'Object is required',
      missingField: null,
    };
  }

  for (const field of requiredFields) {
    if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
      return {
        isValid: false,
        error: `Required field '${field}' is missing`,
        missingField: field,
      };
    }
  }

  return {
    isValid: true,
    error: null,
    missingField: null,
  };
}

/**
 * Validates a daily open count limit.
 *
 * @param {number} limitOpens - The open count limit to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the limit is valid
 * @returns {string} returns.error - Error message if invalid
 */
export function validateDailyOpenLimit(limitOpens) {
  if (typeof limitOpens !== 'number' || isNaN(limitOpens)) {
    return {
      isValid: false,
      error: 'Open limit must be a valid number',
    };
  }

  if (limitOpens <= 0) {
    return {
      isValid: false,
      error: 'Open limit must be greater than 0',
    };
  }

  if (limitOpens > STORAGE_LIMITS.MAX_DAILY_OPEN_LIMIT) {
    return {
      isValid: false,
      error: `Open limit cannot exceed ${STORAGE_LIMITS.MAX_DAILY_OPEN_LIMIT} opens per day`,
    };
  }

  // Check for reasonable limits (warn if very high)
  if (limitOpens > 100) {
    console.warn('[ValidationUtils] High open limit detected:', limitOpens);
  }

  return {
    isValid: true,
    error: null,
  };
}

/**
 * Validates a site object with both time and open limits.
 * Enhanced validation for the new combined limit features.
 *
 * @param {Object} site - The site object to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the site object is valid
 * @returns {string} returns.error - Error message if invalid
 * @returns {Object} returns.sanitizedSite - Sanitized site object if valid
 */
export function validateSiteObject(site) {
  if (!site || typeof site !== 'object') {
    return {
      isValid: false,
      error: 'Site must be an object',
      sanitizedSite: null,
    };
  }

  // Validate required fields
  const requiredFieldsCheck = validateRequiredFields(site, [
    'urlPattern',
    'isEnabled',
  ]);
  if (!requiredFieldsCheck.isValid) {
    return {
      isValid: false,
      error: requiredFieldsCheck.error,
      sanitizedSite: null,
    };
  }

  // Validate URL pattern
  const urlValidation = validateUrlPattern(site.urlPattern);
  if (!urlValidation.isValid) {
    return {
      isValid: false,
      error: urlValidation.error,
      sanitizedSite: null,
    };
  }

  // At least one limit must be specified
  const hasTimeLimit = site.dailyLimitSeconds && site.dailyLimitSeconds > 0;
  const hasOpenLimit = site.dailyOpenLimit && site.dailyOpenLimit > 0;

  if (!hasTimeLimit && !hasOpenLimit) {
    return {
      isValid: false,
      error: 'At least one limit (time or opens) must be specified',
      sanitizedSite: null,
    };
  }

  // Validate time limit if present
  if (hasTimeLimit) {
    const timeLimitValidation = validateDailyTimeLimit(site.dailyLimitSeconds);
    if (!timeLimitValidation.isValid) {
      return {
        isValid: false,
        error: timeLimitValidation.error,
        sanitizedSite: null,
      };
    }
  }

  // Validate open limit if present
  if (hasOpenLimit) {
    const openLimitValidation = validateDailyOpenLimit(site.dailyOpenLimit);
    if (!openLimitValidation.isValid) {
      return {
        isValid: false,
        error: openLimitValidation.error,
        sanitizedSite: null,
      };
    }
  }

  // Create sanitized site object
  const sanitizedSite = {
    id: site.id,
    urlPattern: urlValidation.normalizedPattern,
    isEnabled: Boolean(site.isEnabled),
  };

  // Add limits only if they're valid
  if (hasTimeLimit) {
    sanitizedSite.dailyLimitSeconds = site.dailyLimitSeconds;
  }
  if (hasOpenLimit) {
    sanitizedSite.dailyOpenLimit = site.dailyOpenLimit;
  }

  return {
    isValid: true,
    error: null,
    sanitizedSite: sanitizedSite,
  };
}
