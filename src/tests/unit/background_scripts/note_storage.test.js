import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

/**
 * @file note_storage.test.js
 * @description Unit tests for note_storage.js.
 */

const mockStorageArea = {
  get: jest.fn(),
  set: jest.fn(),
};
global.browser = {
  storage: {
    local: mockStorageArea,
  },
};

const mockCrypto = {
  randomUUID: jest.fn(),
};
global.crypto = mockCrypto;

import {
  getTimeoutNotes,
  addTimeoutNote,
  updateTimeoutNote,
  deleteTimeoutNote,
} from '../../../background_scripts/note_storage.js';

describe('note_storage.js', () => {
  let mockLocalStorageData;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    mockLocalStorageData = {};

    mockStorageArea.get.mockImplementation(async (key) => {
      const result = {};
      if (key === 'timeoutNotes' && mockLocalStorageData.timeoutNotes) {
        result.timeoutNotes = mockLocalStorageData.timeoutNotes;
      }
      return Promise.resolve(result);
    });

    mockStorageArea.set.mockImplementation(async (items) => {
      if (Object.prototype.hasOwnProperty.call(items, 'timeoutNotes')) {
        mockLocalStorageData.timeoutNotes = items.timeoutNotes;
      }
      return Promise.resolve();
    });

    let uuidCounter = 0;
    mockCrypto.randomUUID.mockImplementation(
      () => `test-uuid-${++uuidCounter}`
    );

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockStorageArea.get.mockClear();
    mockStorageArea.set.mockClear();
    mockCrypto.randomUUID.mockClear();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('getTimeoutNotes', () => {
    it('should return an empty array if no notes are stored', async () => {
      const notes = await getTimeoutNotes();
      expect(notes).toEqual([]);
    });

    it('should return stored timeout notes', async () => {
      const storedNotes = [{ id: '1', text: 'Go for a walk' }];
      mockLocalStorageData.timeoutNotes = storedNotes;
      const notes = await getTimeoutNotes();
      expect(notes).toEqual(storedNotes);
    });

    it('should return an empty array on storage error and log error', async () => {
      mockStorageArea.get.mockRejectedValueOnce(new Error('Storage failed'));
      const notes = await getTimeoutNotes();
      expect(notes).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting timeout notes:',
        expect.any(Error)
      );
    });
  });

  describe('addTimeoutNote', () => {
    it('should add a new note with a generated ID', async () => {
      const noteObject = { text: 'Take a break' };
      const addedNote = await addTimeoutNote(noteObject);
      expect(addedNote).toEqual({ id: 'test-uuid-1', text: 'Take a break' });
      expect(mockLocalStorageData.timeoutNotes).toEqual([addedNote]);
    });

    it('should trim text for new note', async () => {
      const noteObject = { text: '  Trimmed note  ' };
      const addedNote = await addTimeoutNote(noteObject);
      expect(addedNote.text).toBe('Trimmed note');
    });

    it('should return null and log error for invalid noteObject', async () => {
      const noteObject = {};
      const result = await addTimeoutNote(noteObject);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return null on storage set error and log error', async () => {
      mockStorageArea.set.mockRejectedValueOnce(new Error('Set failed'));
      const noteObject = { text: 'Fail note' };
      const result = await addTimeoutNote(noteObject);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error adding timeout note:',
        expect.any(Error)
      );
    });
  });

  describe('updateTimeoutNote', () => {
    beforeEach(() => {
      mockLocalStorageData.timeoutNotes = [
        { id: 'test-uuid-1', text: 'Note 1' },
      ];
    });

    it('should update an existing note', async () => {
      const updates = { text: 'Updated Note 1' };
      const updatedNote = await updateTimeoutNote('test-uuid-1', updates);
      expect(updatedNote).toEqual({
        id: 'test-uuid-1',
        text: 'Updated Note 1',
      });
    });

    it('should return null if noteId is not found and log warn', async () => {
      const result = await updateTimeoutNote('non-existent-id', {
        text: 'New text',
      });
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Note with ID "non-existent-id" not found for update.'
      );
    });

    it('should return null on storage set error and log error', async () => {
      mockStorageArea.set.mockRejectedValueOnce(new Error('Set failed'));
      const result = await updateTimeoutNote('test-uuid-1', {
        text: 'New Text',
      });
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating timeout note with ID "test-uuid-1":',
        expect.any(Error)
      );
    });
  });

  describe('deleteTimeoutNote', () => {
    beforeEach(() => {
      mockLocalStorageData.timeoutNotes = [
        { id: 'test-uuid-1', text: 'Note 1' },
        { id: 'test-uuid-2', text: 'Note 2' },
      ];
    });

    it('should delete an existing note and return true', async () => {
      const result = await deleteTimeoutNote('test-uuid-1');
      expect(result).toBe(true);
      expect(mockLocalStorageData.timeoutNotes).toEqual([
        { id: 'test-uuid-2', text: 'Note 2' },
      ]);
    });

    it('should return false if noteId is not found and log warn', async () => {
      const result = await deleteTimeoutNote('non-existent-id');
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Note with ID "non-existent-id" not found for deletion.'
      );
    });

    it('should return false on storage set error and log error', async () => {
      mockStorageArea.set.mockRejectedValueOnce(new Error('Set failed'));
      const result = await deleteTimeoutNote('test-uuid-1');
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error deleting timeout note with ID "test-uuid-1":',
        expect.any(Error)
      );
    });
  });
});
