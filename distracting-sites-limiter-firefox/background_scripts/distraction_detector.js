/**
 * @file distraction_detector.js
 * @description Manages the list of distracting sites and provides a function
 * to check if a given URL is considered distracting based on hostname matching.
 * It loads distracting sites from storage and keeps the list updated if changes occur.
 */

import { getDistractingSites } from './site_storage.js';

let _distractingSitesCache = [];
let _isInitialized = false;
let _onSitesReloadedCallback = null; // Callback for when sites are reloaded

/**
 * Extracts the hostname from a given URL string.
 * @private
 * @param {string} urlString - The URL to parse.
 * @returns {string|null} The hostname, or null if the URL is invalid or not http/https.
 */
function _getHostnameFromUrl(urlString) {
  try {
    if (!urlString || (!urlString.startsWith('http:') && !urlString.startsWith('https:'))) {
      return null;
    }
    const url = new URL(urlString);
    return url.hostname;
  } catch (error) {
    // Log quietly as this can happen with temporary/internal URLs
    // console.warn(`[DistractionDetector] Error parsing URL '${urlString}':`, error.message);
    return null;
  }
}

/**
 * Loads distracting sites from storage and updates the local cache.
 * @returns {Promise<void>}
 */
export async function loadDistractingSitesFromStorage() {
  try {
    const sites = await getDistractingSites();
    _distractingSitesCache = sites && Array.isArray(sites) ? sites : [];
    console.log('[DistractionDetector] Distracting sites cache reloaded:', _distractingSitesCache);
    if (_onSitesReloadedCallback) {
      _onSitesReloadedCallback();
    }
  } catch (error) {
    console.error('[DistractionDetector] Error loading distracting sites from storage:', error);
    _distractingSitesCache = []; // Ensure cache is an array even on error
  }
}

/**
 * Handles changes in browser storage.
 * If `distractingSites` are changed, reloads them into the cache.
 * @param {Object} changes - The changes object from browser.storage.onChanged.
 * @param {string} areaName - The storage area name (e.g., "local", "sync").
 */
async function _handleStorageChange(changes, areaName) {
  if (areaName === 'local' && changes.distractingSites) {
    console.log('[DistractionDetector] Detected change in distractingSites in storage. Reloading cache...');
    await loadDistractingSitesFromStorage();
  }
}

/**
 * Initializes the distraction detector.
 * Loads the initial list of distracting sites and sets up a listener for storage changes.
 * @param {Function} [onSitesReloaded] Optional callback to be invoked when sites are reloaded due to storage changes.
 * @returns {Promise<void>}
 */
export async function initializeDistractionDetector(onSitesReloaded) {
  if (_isInitialized) {
    console.warn('[DistractionDetector] Already initialized.');
    return;
  }
  console.log('[DistractionDetector] Initializing...');
  if (onSitesReloaded) {
    _onSitesReloadedCallback = onSitesReloaded;
  }
  await loadDistractingSitesFromStorage();
  browser.storage.onChanged.addListener(_handleStorageChange);
  _isInitialized = true;
  console.log('[DistractionDetector] Initialization complete.');
}

/**
 * Checks if the given URL matches any of the cached distracting sites based on hostname.
 * @param {string} url - The URL to check.
 * @returns {{isMatch: boolean, siteId: string|null, matchingPattern: string|null}} 
 *           Object indicating if it's a match, the ID of the matched site, and the pattern that matched.
 */
export function checkIfUrlIsDistracting(url) {
  if (!_isInitialized) {
    console.warn('[DistractionDetector] Detector not initialized. Call initializeDistractionDetector first.');
    return { isMatch: false, siteId: null, matchingPattern: null };
  }
  const currentHostname = _getHostnameFromUrl(url);
  if (!currentHostname) {
    return { isMatch: false, siteId: null, matchingPattern: null };
  }

  for (const site of _distractingSitesCache) {
    // Ensure site.urlPattern exists and is a string before attempting to match
    if (site.urlPattern && typeof site.urlPattern === 'string') {
      // The pattern should be a substring of the hostname, not the other way around
      // This allows 'example.com' to match both 'example.com' and 'sub.example.com'
      if (currentHostname.includes(site.urlPattern) && site.isEnabled !== false) {
        return { isMatch: true, siteId: site.id, matchingPattern: site.urlPattern };
      }
    }
  }
  return { isMatch: false, siteId: null, matchingPattern: null };
}

// Assume initializeDistractionDetector will be called by time_tracker.js orchestrator. 