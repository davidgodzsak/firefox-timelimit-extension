/**
 * @file validation_utils.test.js
 * @description Unit tests for the validation utilities module.
 * Tests all validation functions, error categorization, and edge cases.
 */

import { 
  validateUrlPattern, 
  validateDailyTimeLimit, 
  validateNoteText, 
  validateStorageLimits,
  validateRequiredFields,
  categorizeError,
  createValidationError,
  safeBrowserApiCall,
  ERROR_TYPES
} from '../../../background_scripts/validation_utils.js';

describe('ValidationUtils', () => {
  
  describe('validateUrlPattern', () => {
    test('should accept valid domain names', () => {
      const validDomains = [
        'example.com',
        'subdomain.example.com',
        'test-site.org',
        'my-site123.net',
        'https://example.com',
        'http://www.example.com',
        'Example.COM' // Case insensitive
      ];
      
      validDomains.forEach(domain => {
        const result = validateUrlPattern(domain);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.normalizedPattern).toBeTruthy();
      });
    });
    
    test('should reject invalid inputs', () => {
      const invalidInputs = [
        '',
        null,
        undefined,
        123,
        {},
        []
      ];
      
      invalidInputs.forEach(input => {
        const result = validateUrlPattern(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.normalizedPattern).toBeNull();
      });
    });
    
    test('should reject dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'chrome://settings',
        'moz-extension://xyz'
      ];
      
      dangerousUrls.forEach(url => {
        const result = validateUrlPattern(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('restricted protocol');
      });
    });
    
    test('should handle very long URLs', () => {
      const longUrl = 'a'.repeat(2001) + '.com';
      const result = validateUrlPattern(longUrl);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
    
    test('should normalize URLs correctly', () => {
      const testCases = [
        { input: 'https://www.example.com', expected: 'example.com' },
        { input: 'HTTP://Example.COM', expected: 'example.com' },
        { input: 'www.Test-Site.org', expected: 'test-site.org' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = validateUrlPattern(input);
        expect(result.isValid).toBe(true);
        expect(result.normalizedPattern).toBe(expected);
      });
    });
  });
  
  describe('validateDailyTimeLimit', () => {
    test('should accept valid time limits', () => {
      const validLimits = [1, 60, 3600, 43200, 86400]; // 1 sec to 24 hours
      
      validLimits.forEach(limit => {
        const result = validateDailyTimeLimit(limit);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });
    
    test('should reject invalid time limits', () => {
      const invalidLimits = [
        0,
        -1,
        86401, // More than 24 hours
        NaN,
        'string',
        null,
        undefined,
        {}
      ];
      
      invalidLimits.forEach(limit => {
        const result = validateDailyTimeLimit(limit);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });
  });
  
  describe('validateNoteText', () => {
    test('should accept valid note text', () => {
      const validNotes = [
        'Go for a walk',
        'Take a break and stretch',
        'Read a book',
        'A'.repeat(1000) // Max length
      ];
      
      validNotes.forEach(note => {
        const result = validateNoteText(note);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.sanitizedText).toBeTruthy();
      });
    });
    
    test('should reject invalid note text', () => {
      const invalidNotes = [
        '',
        '   ', // Only whitespace
        null,
        undefined,
        123,
        'A'.repeat(1001) // Too long
      ];
      
      invalidNotes.forEach(note => {
        const result = validateNoteText(note);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.sanitizedText).toBeNull();
      });
    });
    
    test('should sanitize HTML in note text', () => {
      const dangerousText = '<script>alert("xss")</script>Hello & "world"';
      const result = validateNoteText(dangerousText);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedText).not.toContain('<script>');
      expect(result.sanitizedText).not.toContain('alert(');
      expect(result.sanitizedText).toContain('&lt;');
      expect(result.sanitizedText).toContain('&gt;');
      expect(result.sanitizedText).toContain('&amp;');
      expect(result.sanitizedText).toContain('&quot;');
    });
  });
  
  describe('validateStorageLimits', () => {
    test('should accept valid storage counts', () => {
      const testCases = [
        { dataType: 'sites', currentCount: 0 },
        { dataType: 'sites', currentCount: 100 },
        { dataType: 'sites', currentCount: 499 },
        { dataType: 'notes', currentCount: 0 },
        { dataType: 'notes', currentCount: 500 },
        { dataType: 'notes', currentCount: 999 }
      ];
      
      testCases.forEach(({ dataType, currentCount }) => {
        const result = validateStorageLimits(dataType, currentCount);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });
    
    test('should reject when limits are exceeded', () => {
      const testCases = [
        { dataType: 'sites', currentCount: 500 },
        { dataType: 'sites', currentCount: 501 },
        { dataType: 'notes', currentCount: 1000 },
        { dataType: 'notes', currentCount: 1001 }
      ];
      
      testCases.forEach(({ dataType, currentCount }) => {
        const result = validateStorageLimits(dataType, currentCount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Maximum number');
      });
    });
    
    test('should reject unknown data types', () => {
      const result = validateStorageLimits('unknown', 0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown data type');
    });
  });
  
  describe('validateRequiredFields', () => {
    test('should accept objects with all required fields', () => {
      const obj = { name: 'test', value: 123, enabled: true };
      const result = validateRequiredFields(obj, ['name', 'value']);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.missingField).toBeNull();
    });
    
    test('should reject objects missing required fields', () => {
      const obj = { name: 'test' };
      const result = validateRequiredFields(obj, ['name', 'value']);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Required field');
      expect(result.missingField).toBe('value');
    });
    
    test('should reject objects with null/undefined values', () => {
      const obj = { name: 'test', value: null };
      const result = validateRequiredFields(obj, ['name', 'value']);
      
      expect(result.isValid).toBe(false);
      expect(result.missingField).toBe('value');
    });
    
    test('should reject non-objects', () => {
      const invalidObjects = [null, undefined, 'string', 123, []];
      
      invalidObjects.forEach(obj => {
        const result = validateRequiredFields(obj, ['name']);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Object is required');
      });
    });
  });
  
  describe('categorizeError', () => {
    test('should categorize extension context errors', () => {
      const errors = [
        new Error('Extension context invalidated'),
        new Error('Message port closed'),
        new Error('Receiving end does not exist')
      ];
      
      errors.forEach(error => {
        const result = categorizeError(error);
        expect(result.type).toBe(ERROR_TYPES.EXTENSION_CONTEXT);
        expect(result.userMessage).toContain('Extension was reloaded');
        expect(result.isRetryable).toBe(false);
      });
    });
    
    test('should categorize storage errors', () => {
      const errors = [
        new Error('Quota exceeded'),
        new Error('Storage full'),
        new Error('Exceeded storage quota')
      ];
      
      errors.forEach(error => {
        const result = categorizeError(error);
        expect(result.type).toBe(ERROR_TYPES.STORAGE);
        expect(result.userMessage).toContain('Storage limit');
        expect(result.isRetryable).toBe(false);
      });
    });
    
    test('should categorize network errors', () => {
      const errors = [
        new Error('Network error'),
        new Error('Connection failed'),
        new Error('Request timeout')
      ];
      
      errors.forEach(error => {
        const result = categorizeError(error);
        expect(result.type).toBe(ERROR_TYPES.NETWORK);
        expect(result.userMessage).toContain('Connection error');
        expect(result.isRetryable).toBe(true);
      });
    });
    
    test('should categorize browser API errors', () => {
      const errors = [
        new Error('tabs.query failed'),
        new Error('storage.local error'),
        new Error('runtime.sendMessage failed')
      ];
      
      errors.forEach(error => {
        const result = categorizeError(error);
        expect(result.type).toBe(ERROR_TYPES.BROWSER_API);
        expect(result.userMessage).toContain('Browser API error');
        expect(result.isRetryable).toBe(true);
      });
    });
    
    test('should categorize validation errors', () => {
      const error = createValidationError('Invalid input', 'testField');
      
      const result = categorizeError(error);
      expect(result.type).toBe(ERROR_TYPES.VALIDATION);
      expect(result.userMessage).toBe('Invalid input');
      expect(result.isRetryable).toBe(false);
    });
    
    test('should handle null/undefined errors', () => {
      const result = categorizeError(null);
      expect(result.type).toBe(ERROR_TYPES.UNKNOWN);
      expect(result.userMessage).toContain('unknown error');
      expect(result.isRetryable).toBe(false);
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
  
  describe('safeBrowserApiCall', () => {
    test('should handle successful API calls', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ data: 'success' });
      
      const result = await safeBrowserApiCall(mockApiCall, ['arg1', 'arg2'], 'Test API');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'success' });
      expect(result.error).toBeNull();
      expect(mockApiCall).toHaveBeenCalledWith('arg1', 'arg2');
    });
    
    test('should handle API call failures', async () => {
      const mockApiCall = jest.fn().mockRejectedValue(new Error('API failed'));
      
      const result = await safeBrowserApiCall(mockApiCall, [], 'Test API');
      
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error.message).toBeTruthy();
      expect(result.error.type).toBeTruthy();
      expect(result.error.isRetryable).toBeDefined();
    });
    
    test('should handle extension context errors specifically', async () => {
      const mockApiCall = jest.fn().mockRejectedValue(new Error('Extension context invalidated'));
      
      const result = await safeBrowserApiCall(mockApiCall, [], 'Test API');
      
      expect(result.success).toBe(false);
      expect(result.error.type).toBe(ERROR_TYPES.EXTENSION_CONTEXT);
      expect(result.error.isRetryable).toBe(false);
    });
  });
  
  describe('Edge Cases and Integration', () => {
    test('should handle unicode characters in URLs', () => {
      const unicodeUrl = 'тест.com';
      const result = validateUrlPattern(unicodeUrl);
      // Should reject non-ASCII characters in basic validation
      expect(result.isValid).toBe(false);
    });
    
    test('should handle very long note text', () => {
      const longNote = 'A'.repeat(1000);
      const result = validateNoteText(longNote);
      expect(result.isValid).toBe(true);
      
      const tooLongNote = 'A'.repeat(1001);
      const result2 = validateNoteText(tooLongNote);
      expect(result2.isValid).toBe(false);
    });
    
    test('should handle edge cases in time limits', () => {
      // Test boundary values
      expect(validateDailyTimeLimit(1).isValid).toBe(true);
      expect(validateDailyTimeLimit(86400).isValid).toBe(true);
      expect(validateDailyTimeLimit(86401).isValid).toBe(false);
      expect(validateDailyTimeLimit(0).isValid).toBe(false);
    });
  });
}); 