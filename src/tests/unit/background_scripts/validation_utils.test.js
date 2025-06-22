/**
 * @file validation_utils.test.js
 * @description Unit tests for validation utilities module
 * Tests URL pattern validation, time/open limit validation, error categorization, and enhanced validation features
 */

import { jest } from '@jest/globals';
import {
  validateUrlPattern,
  validateDailyTimeLimit,
  validateDailyOpenLimit,
  validateNoteText,
  validateStorageLimits,
  categorizeError,
  safeBrowserApiCall,
  createValidationError,
  validateRequiredFields,
  validateSiteObject,
  ERROR_TYPES,
} from '../../../background_scripts/validation_utils.js';

describe('ValidationUtils', () => {
  describe('validateUrlPattern', () => {
    test('should validate correct URL patterns', () => {
      const result = validateUrlPattern('example.com');
      expect(result.isValid).toBe(true);
      expect(result.normalizedPattern).toBe('example.com');
      expect(result.error).toBeNull();
    });

    test('should normalize URL patterns', () => {
      const result = validateUrlPattern('https://www.Example.COM/path');
      expect(result.isValid).toBe(true);
      expect(result.normalizedPattern).toBe('example.com/path');
    });

    test('should reject empty patterns', () => {
      const result = validateUrlPattern('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    test('should reject null/undefined patterns', () => {
      const result1 = validateUrlPattern(null);
      const result2 = validateUrlPattern(undefined);
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });

    test('should reject dangerous patterns', () => {
      const result = validateUrlPattern('javascript:alert()');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    test('should reject too long patterns', () => {
      const longPattern = 'a'.repeat(2001);
      const result = validateUrlPattern(longPattern);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('validateDailyTimeLimit', () => {
    test('should validate correct time limits', () => {
      const result = validateDailyTimeLimit(3600); // 1 hour
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should reject zero or negative limits', () => {
      expect(validateDailyTimeLimit(0).isValid).toBe(false);
      expect(validateDailyTimeLimit(-100).isValid).toBe(false);
    });

    test('should reject non-numeric limits', () => {
      expect(validateDailyTimeLimit('not a number').isValid).toBe(false);
      expect(validateDailyTimeLimit(null).isValid).toBe(false);
      expect(validateDailyTimeLimit(undefined).isValid).toBe(false);
    });

    test('should reject limits exceeding 24 hours', () => {
      const result = validateDailyTimeLimit(86401); // 24 hours + 1 second
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('24 hours');
    });
  });

  describe('validateDailyOpenLimit', () => {
    test('should validate correct open limits', () => {
      const result = validateDailyOpenLimit(10);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should reject zero or negative limits', () => {
      expect(validateDailyOpenLimit(0).isValid).toBe(false);
      expect(validateDailyOpenLimit(-5).isValid).toBe(false);
    });

    test('should reject non-numeric limits', () => {
      expect(validateDailyOpenLimit('not a number').isValid).toBe(false);
      expect(validateDailyOpenLimit(null).isValid).toBe(false);
      expect(validateDailyOpenLimit(undefined).isValid).toBe(false);
    });

    test('should reject limits exceeding maximum', () => {
      const result = validateDailyOpenLimit(1001);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1000 opens per day');
    });

    test('should warn about high limits', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      validateDailyOpenLimit(150);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ValidationUtils] High open limit detected:',
        150
      );
      consoleSpy.mockRestore();
    });
  });

  describe('validateSiteObject', () => {
    const validSite = {
      id: 'test-site',
      urlPattern: 'example.com',
      isEnabled: true,
      dailyLimitSeconds: 3600,
      dailyOpenLimit: 10,
    };

    test('should validate complete site object', () => {
      const result = validateSiteObject(validSite);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedSite).toMatchObject({
        id: 'test-site',
        urlPattern: 'example.com',
        isEnabled: true,
        dailyLimitSeconds: 3600,
        dailyOpenLimit: 10,
      });
    });

    test('should validate site with only time limit', () => {
      const timeOnlySite = {
        id: 'test-site',
        urlPattern: 'example.com',
        isEnabled: true,
        dailyLimitSeconds: 3600,
      };
      const result = validateSiteObject(timeOnlySite);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedSite.dailyLimitSeconds).toBe(3600);
      expect(result.sanitizedSite.dailyOpenLimit).toBeUndefined();
    });

    test('should validate site with only open limit', () => {
      const openOnlySite = {
        id: 'test-site',
        urlPattern: 'example.com',
        isEnabled: true,
        dailyOpenLimit: 10,
      };
      const result = validateSiteObject(openOnlySite);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedSite.dailyOpenLimit).toBe(10);
      expect(result.sanitizedSite.dailyLimitSeconds).toBeUndefined();
    });

    test('should reject site without any limits', () => {
      const noLimitsSite = {
        id: 'test-site',
        urlPattern: 'example.com',
        isEnabled: true,
      };
      const result = validateSiteObject(noLimitsSite);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('At least one limit');
    });

    test('should reject site without required fields', () => {
      const incompleteSite = {
        id: 'test-site',
        // missing urlPattern and isEnabled
      };
      const result = validateSiteObject(incompleteSite);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Required field');
    });

    test('should reject site with invalid URL pattern', () => {
      const invalidUrlSite = {
        ...validSite,
        urlPattern: 'javascript:alert()',
      };
      const result = validateSiteObject(invalidUrlSite);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    test('should reject site with invalid time limit', async () => {
      const invalidTimeSite = {
        id: 'test-site',
        urlPattern: 'example.com',
        isEnabled: true,
        dailyLimitSeconds: 90000, // Invalid - exceeds 24 hours (86400 seconds)
      };
      const result = validateSiteObject(invalidTimeSite);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('24 hours');
    });

    test('should reject site with invalid open limit', () => {
      const invalidOpenSite = {
        ...validSite,
        dailyOpenLimit: 2000,
      };
      const result = validateSiteObject(invalidOpenSite);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1000 opens per day');
    });

    test('should handle null/undefined site object', () => {
      expect(validateSiteObject(null).isValid).toBe(false);
      expect(validateSiteObject(undefined).isValid).toBe(false);
    });
  });

  describe('categorizeError', () => {
    test('should categorize extension context errors', () => {
      const error = new Error('Extension context invalidated');
      const result = categorizeError(error);
      expect(result.type).toBe(ERROR_TYPES.EXTENSION_CONTEXT);
      expect(result.isRetryable).toBe(false);
      expect(result.userMessage).toContain('refresh');
    });

    test('should categorize storage errors', () => {
      const error = new Error('Quota exceeded for storage');
      const result = categorizeError(error);
      expect(result.type).toBe(ERROR_TYPES.STORAGE);
      expect(result.isRetryable).toBe(false);
      expect(result.userMessage).toContain('Storage limit');
    });

    test('should categorize network errors', () => {
      const error = new Error('Network connection failed');
      const result = categorizeError(error);
      expect(result.type).toBe(ERROR_TYPES.NETWORK);
      expect(result.isRetryable).toBe(true);
      expect(result.userMessage).toContain('connection');
    });

    test('should categorize browser API errors', () => {
      const error = new Error('tabs.query failed');
      const result = categorizeError(error);
      expect(result.type).toBe(ERROR_TYPES.BROWSER_API);
      expect(result.isRetryable).toBe(true);
      expect(result.userMessage).toContain('Browser API');
    });

    test('should categorize validation errors', () => {
      const error = createValidationError('Invalid input');
      const result = categorizeError(error);
      expect(result.type).toBe(ERROR_TYPES.VALIDATION);
      expect(result.isRetryable).toBe(false);
      expect(result.userMessage).toBe('Invalid input');
    });

    test('should handle unknown errors', () => {
      const error = new Error('Some unknown error');
      const result = categorizeError(error);
      expect(result.type).toBe(ERROR_TYPES.UNKNOWN);
      expect(result.isRetryable).toBe(true);
      expect(result.userMessage).toContain('unexpected');
    });

    test('should handle null/undefined errors', () => {
      const result = categorizeError(null);
      expect(result.type).toBe(ERROR_TYPES.UNKNOWN);
      expect(result.isRetryable).toBe(false);
    });
  });

  describe('safeBrowserApiCall', () => {
    test('should handle successful API calls', async () => {
      const mockApiCall = jest.fn().mockResolvedValue('success');
      const result = await safeBrowserApiCall(
        mockApiCall,
        ['arg1', 'arg2'],
        'Test API'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.error).toBeNull();
      expect(mockApiCall).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should handle failed API calls', async () => {
      const mockApiCall = jest.fn().mockRejectedValue(new Error('API failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await safeBrowserApiCall(mockApiCall, [], 'Test API');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({
        message: expect.any(String),
        type: expect.any(String),
        isRetryable: expect.any(Boolean),
      });

      consoleSpy.mockRestore();
    });

    test('should handle extension context errors specifically', async () => {
      const mockApiCall = jest
        .fn()
        .mockRejectedValue(new Error('Extension context invalidated'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await safeBrowserApiCall(mockApiCall, [], 'Test API');

      expect(result.error.type).toBe(ERROR_TYPES.EXTENSION_CONTEXT);
      expect(result.error.isRetryable).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('validateRequiredFields', () => {
    test('should validate object with all required fields', () => {
      const obj = { name: 'test', value: 123, enabled: true };
      const result = validateRequiredFields(obj, ['name', 'value']);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.missingField).toBeNull();
    });

    test('should detect missing fields', () => {
      const obj = { name: 'test' };
      const result = validateRequiredFields(obj, ['name', 'value']);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('value');
      expect(result.missingField).toBe('value');
    });

    test('should handle null/undefined values as missing', () => {
      const obj = { name: 'test', value: null, other: undefined };
      const result = validateRequiredFields(obj, ['name', 'value', 'other']);
      expect(result.isValid).toBe(false);
      expect(result.missingField).toBe('value');
    });

    test('should handle null/undefined object', () => {
      const result1 = validateRequiredFields(null, ['field']);
      const result2 = validateRequiredFields(undefined, ['field']);
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });
  });

  describe('createValidationError', () => {
    test('should create validation error with correct properties', () => {
      const error = createValidationError('Test message', 'testField');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test message');
      expect(error.field).toBe('testField');
    });

    test('should create validation error without field', () => {
      const error = createValidationError('Test message');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBeNull();
    });
  });

  describe('validateStorageLimits', () => {
    test('should validate within limits', () => {
      const result = validateStorageLimits('sites', 100);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should reject when at limit', () => {
      const result = validateStorageLimits('sites', 500);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Maximum number');
    });

    test('should handle unknown data types', () => {
      const result = validateStorageLimits('unknown', 10);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown data type');
    });
  });

  describe('validateNoteText', () => {
    test('should validate correct note text', () => {
      const result = validateNoteText('This is a valid note');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedText).toBe('This is a valid note');
      expect(result.error).toBeNull();
    });

    test('should sanitize HTML characters', () => {
      const result = validateNoteText(
        'Note with <script>alert("xss")</script>'
      );
      expect(result.isValid).toBe(true);
      expect(result.sanitizedText).toContain('&lt;script&gt;');
      expect(result.sanitizedText).not.toContain('<script>');
    });

    test('should reject empty text', () => {
      expect(validateNoteText('').isValid).toBe(false);
      expect(validateNoteText('   ').isValid).toBe(false);
    });

    test('should reject null/undefined text', () => {
      expect(validateNoteText(null).isValid).toBe(false);
      expect(validateNoteText(undefined).isValid).toBe(false);
    });

    test('should reject too long text', () => {
      const longText = 'a'.repeat(1001);
      const result = validateNoteText(longText);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('Error handling edge cases', () => {
    test('should handle complex error scenarios', () => {
      const errors = [
        new Error('Extension context invalidated'),
        new Error('Message port closed'),
        new Error('Receiving end does not exist'),
        new Error('Storage quota exceeded'),
        new Error('Network timeout'),
        new Error('tabs.create failed'),
        new Error('Unknown browser error'),
      ];

      errors.forEach((error) => {
        const result = categorizeError(error);
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('userMessage');
        expect(result).toHaveProperty('isRetryable');
        expect(typeof result.isRetryable).toBe('boolean');
      });
    });

    test('should handle error objects without messages', () => {
      const error = { toString: () => 'Error without message property' };
      const result = categorizeError(error);
      expect(result.type).toBe(ERROR_TYPES.UNKNOWN);
    });
  });

  describe('Performance and memory considerations', () => {
    test('should not create memory leaks with large validation sets', () => {
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `site-${i}`,
        urlPattern: `example${i}.com`,
        isEnabled: true,
        dailyLimitSeconds: 3600,
      }));

      let validCount = 0;
      largeDataSet.forEach((site) => {
        const result = validateSiteObject(site);
        if (result.isValid) validCount++;
      });

      expect(validCount).toBe(1000);
    });

    test('should handle validation of extremely long strings efficiently', () => {
      const start = Date.now();
      const longString = 'a'.repeat(10000);
      validateUrlPattern(longString);
      const end = Date.now();

      // Should complete within reasonable time (less than 100ms)
      expect(end - start).toBeLessThan(100);
    });
  });
});
