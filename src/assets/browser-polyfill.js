/*
 * This is a minimal browser-polyfill for Firefox extensions.
 * In Firefox, the 'browser' object is already available, so we just need to ensure it exists.
 */
if (typeof browser === 'undefined') {
  throw new Error(
    'Browser API not available. This script should only be used in Firefox extensions.'
  );
}
