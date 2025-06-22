/**
 * @file distraction_detector.test.js
 * @description Unit tests for the distraction_detector.js module.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock the site_storage module
const mockGetDistractingSites = jest.fn();
jest.unstable_mockModule('../../../background_scripts/site_storage.js', () => ({
  getDistractingSites: mockGetDistractingSites,
}));

// Mock browser API
const mockStorageArea = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockOnChanged = {
  addListener: jest.fn(),
  removeListener: jest.fn(),
  hasListener: jest.fn(),
};

global.browser = {
  storage: {
    local: mockStorageArea,
    onChanged: mockOnChanged,
  },
};

// Declare variables for the imported functions, to be assigned in beforeEach
let initializeDistractionDetector;
let checkIfUrlIsDistracting;
let loadDistractingSitesFromStorage;

describe('DistractionDetector', () => {
  beforeEach(async () => {
    jest.resetModules(); // Reset module cache

    // Clear all mocks
    mockGetDistractingSites.mockReset();
    mockOnChanged.addListener.mockReset();
    mockOnChanged.removeListener.mockReset();
    mockOnChanged.hasListener.mockReset();
    mockStorageArea.get.mockReset();
    mockStorageArea.set.mockReset();

    // Re-import the module to get a fresh state
    const detectorModule = await import(
      '../../../background_scripts/distraction_detector.js'
    );
    initializeDistractionDetector =
      detectorModule.initializeDistractionDetector;
    checkIfUrlIsDistracting = detectorModule.checkIfUrlIsDistracting;
    loadDistractingSitesFromStorage =
      detectorModule.loadDistractingSitesFromStorage;
  });

  const sampleSites = [
    { id: '1', urlPattern: 'example.com', isEnabled: true },
    { id: '2', urlPattern: 'another-site.org', isEnabled: true },
    { id: '3', urlPattern: 'disabled-site.net', isEnabled: false },
    { id: '4', urlPattern: 'youtube.com', isEnabled: true },
  ];

  describe('Behavior Before Initialization', () => {
    let consoleWarnSpy;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should return false and warn if checkIfUrlIsDistracting is called before initialization', () => {
      const result = checkIfUrlIsDistracting('http://example.com');
      expect(result.isMatch).toBe(false);
      expect(result.siteId).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[DistractionDetector] Detector not initialized. Call initializeDistractionDetector first.'
      );
      expect(mockGetDistractingSites).not.toHaveBeenCalled();
    });
  });

  describe('initializeDistractionDetector', () => {
    it('should load distracting sites from storage on initialization', async () => {
      mockGetDistractingSites.mockResolvedValue([...sampleSites]);
      await initializeDistractionDetector();
      expect(mockGetDistractingSites).toHaveBeenCalledTimes(1);
    });

    it('should register a storage.onChanged listener', async () => {
      mockGetDistractingSites.mockResolvedValue([]);
      await initializeDistractionDetector();
      expect(browser.storage.onChanged.addListener).toHaveBeenCalledTimes(1);
    });

    it('should call onSitesReloaded callback if provided during initialization after initial load', async () => {
      const onSitesReloadedMock = jest.fn();
      mockGetDistractingSites.mockResolvedValue([...sampleSites]);
      await initializeDistractionDetector(onSitesReloadedMock);
      expect(mockGetDistractingSites).toHaveBeenCalledTimes(1);
      expect(onSitesReloadedMock).toHaveBeenCalledTimes(1);
    });

    it('should warn and not reinitialize if already initialized', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      // First initialization
      mockGetDistractingSites.mockResolvedValue([...sampleSites]);
      await initializeDistractionDetector();
      expect(mockGetDistractingSites).toHaveBeenCalledTimes(1);
      expect(browser.storage.onChanged.addListener).toHaveBeenCalledTimes(1);

      // Reset mocks to track second call
      mockGetDistractingSites.mockClear();
      browser.storage.onChanged.addListener.mockClear();

      // Second initialization attempt
      await initializeDistractionDetector();

      // Verify warning was shown
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[DistractionDetector] Already initialized.'
      );

      // Verify no repeated initialization
      expect(mockGetDistractingSites).not.toHaveBeenCalled();
      expect(browser.storage.onChanged.addListener).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('loadDistractingSitesFromStorage', () => {
    it('should handle errors when loading sites from storage', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Make getDistractingSites throw an error
      const testError = new Error('Test storage error');
      mockGetDistractingSites.mockRejectedValue(testError);

      await loadDistractingSitesFromStorage();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[DistractionDetector] Error loading distracting sites from storage:',
        testError
      );

      // Test that despite the error, further operations can proceed
      // Cache should be set to an empty array to prevent undefined errors
      const result = checkIfUrlIsDistracting('http://example.com');
      expect(result.isMatch).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed data from storage', async () => {
      // Test various invalid return values
      mockGetDistractingSites.mockResolvedValue(null);
      await loadDistractingSitesFromStorage();

      // Should handle null by converting to empty array
      let result = checkIfUrlIsDistracting('http://example.com');
      expect(result.isMatch).toBe(false);

      // Test with non-array value
      mockGetDistractingSites.mockResolvedValue({ notAnArray: true });
      await loadDistractingSitesFromStorage();

      result = checkIfUrlIsDistracting('http://example.com');
      expect(result.isMatch).toBe(false);
    });
  });

  describe('checkIfUrlIsDistracting (when initialized)', () => {
    beforeEach(async () => {
      // Ensure detector is initialized for these tests
      mockGetDistractingSites.mockResolvedValue([...sampleSites]);
      await initializeDistractionDetector();
      mockGetDistractingSites.mockClear(); // Clear call count from init
    });

    it('should return true for a matching distracting site URL', () => {
      const result = checkIfUrlIsDistracting('http://www.example.com/page');
      expect(result.isMatch).toBe(true);
      expect(result.siteId).toBe('1');
      expect(result.matchingPattern).toBe('example.com');
    });

    it('should return true for a matching distracting site URL with https', () => {
      const result = checkIfUrlIsDistracting('https://youtube.com/watch?v=123');
      expect(result.isMatch).toBe(true);
      expect(result.siteId).toBe('4');
    });

    it('should return false for a non-distracting URL', () => {
      const result = checkIfUrlIsDistracting('http://non-distracting.com');
      expect(result.isMatch).toBe(false);
      expect(result.siteId).toBeNull();
    });

    it('should return false for disabled sites', () => {
      const result = checkIfUrlIsDistracting('http://disabled-site.net');
      expect(result.isMatch).toBe(false);
      expect(result.siteId).toBeNull();
    });

    it('should handle URLs with different subdomains correctly based on hostname matching', () => {
      // Assuming 'example.com' pattern should match 'sub.example.com' due to includes logic
      const result = checkIfUrlIsDistracting(
        'https://sub.example.com/another/page'
      );
      expect(result.isMatch).toBe(true);
      expect(result.siteId).toBe('1');
    });

    it('should handle invalid URLs gracefully', () => {
      const result = checkIfUrlIsDistracting('not-a-url');
      expect(result.isMatch).toBe(false);
      expect(result.siteId).toBeNull();
    });
  });

  describe('Storage Change Handling', () => {
    it('should reload distracting sites when storage.onChanged fires for distractingSites', async () => {
      mockGetDistractingSites.mockResolvedValue([...sampleSites]);
      await initializeDistractionDetector();
      expect(mockGetDistractingSites).toHaveBeenCalledTimes(1); // Initial load

      const newSites = [
        { id: '5', urlPattern: 'newsite.com', isEnabled: true },
      ];
      mockGetDistractingSites.mockResolvedValue([...newSites]); // Setup for the next call

      // Get the registered change listener and call it
      const changeCallback =
        browser.storage.onChanged.addListener.mock.calls[0][0];
      await changeCallback(
        { distractingSites: { newValue: newSites } },
        'local'
      );

      expect(mockGetDistractingSites).toHaveBeenCalledTimes(2); // Should have reloaded

      // Verify the cache was updated by checking a URL match
      const result = checkIfUrlIsDistracting('http://newsite.com');
      expect(result.isMatch).toBe(true);
      expect(result.siteId).toBe('5');
    });

    it('should not reload if storage change is not for distractingSites or not in local area', async () => {
      mockGetDistractingSites.mockResolvedValue([...sampleSites]);
      await initializeDistractionDetector();
      expect(mockGetDistractingSites).toHaveBeenCalledTimes(1);

      expect(browser.storage.onChanged.addListener).toHaveBeenCalled();
      const changeCallback =
        browser.storage.onChanged.addListener.mock.calls[0][0];

      // Call with changes to other storage keys
      await changeCallback({ otherKey: { newValue: 'something' } }, 'local');
      await changeCallback({ distractingSites: { newValue: [] } }, 'sync');

      // Should not have reloaded
      expect(mockGetDistractingSites).toHaveBeenCalledTimes(1);
    });

    it('should call onSitesReloaded callback if provided when sites are reloaded via storage change', async () => {
      const onSitesReloadedMock = jest.fn();
      mockGetDistractingSites.mockResolvedValue([...sampleSites]);
      await initializeDistractionDetector(onSitesReloadedMock);
      expect(onSitesReloadedMock).toHaveBeenCalledTimes(1); // Called after initial load

      const newSites = [
        { id: '5', urlPattern: 'newsite.com', isEnabled: true },
      ];
      mockGetDistractingSites.mockResolvedValue([...newSites]);

      const changeCallback =
        browser.storage.onChanged.addListener.mock.calls[0][0];
      await changeCallback(
        { distractingSites: { newValue: newSites } },
        'local'
      );

      expect(mockGetDistractingSites).toHaveBeenCalledTimes(2); // Initial + reload
      expect(onSitesReloadedMock).toHaveBeenCalledTimes(2); // Called again after reload
    });
  });
});
