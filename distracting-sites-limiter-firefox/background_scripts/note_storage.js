/**
 * @file note_storage.js
 * @description Manages CRUD operations for timeout notes in browser.storage.local.
 */

/**
 * Retrieves the list of timeout notes from storage.
 *
 * @async
 * @function getTimeoutNotes
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of timeout note objects.
 *                                    Returns an empty array if no notes are found or an error occurs.
 */
export async function getTimeoutNotes() {
  try {
    const result = await browser.storage.local.get("timeoutNotes");
    return result.timeoutNotes || [];
  } catch (error) {
    console.error("Error getting timeout notes:", error);
    return [];
  }
}

/**
 * Adds a new timeout note to the storage.
 * Validates the note object and generates a unique ID.
 *
 * @async
 * @function addTimeoutNote
 * @param {Object} noteObject - The note object to add.
 * @param {string} noteObject.text - The text content of the note.
 * @returns {Promise<Object|null>} A promise that resolves to the added note object (including its new ID)
 *                                 or null if validation fails or a storage error occurs.
 */
export async function addTimeoutNote(noteObject) {
    if (!noteObject || typeof noteObject.text !== 'string' || noteObject.text.trim() === '') {
        console.error("Invalid noteObject provided to addTimeoutNote. 'text' (non-empty string) is required.", noteObject);
        return null;
    }

    const newNote = {
        id: crypto.randomUUID(),
        text: noteObject.text.trim(),
    };

    try {
        const notes = await getTimeoutNotes();
        notes.push(newNote);
        await browser.storage.local.set({ timeoutNotes: notes });
        return newNote;
    } catch (error) {
        console.error("Error adding timeout note:", error);
        return null;
    }
}

/**
 * Updates an existing timeout note in storage by its ID.
 *
 * @async
 * @function updateTimeoutNote
 * @param {string} noteId - The ID of the note to update.
 * @param {Object} updates - An object containing the properties to update.
 * @param {string} [updates.text] - The new text for the note.
 * @returns {Promise<Object|null>} A promise that resolves to the updated note object
 *                                 or null if the note is not found, validation fails, or a storage error occurs.
 */
export async function updateTimeoutNote(noteId, updates) {
    if (!noteId || typeof noteId !== 'string') {
        console.error("Invalid noteId provided to updateTimeoutNote.");
        return null;
    }
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        console.error("Invalid updates object provided to updateTimeoutNote.", updates);
        return null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'text') && (typeof updates.text !== 'string' || updates.text.trim() === '')) {
        console.error("Invalid text in updates for updateTimeoutNote.", updates.text);
        return null;
    }

    try {
        const notes = await getTimeoutNotes();
        const noteIndex = notes.findIndex(note => note.id === noteId);

        if (noteIndex === -1) {
            console.warn(`Note with ID "${noteId}" not found for update.`);
            return null;
        }

        const updatedNote = { ...notes[noteIndex], ...updates };
        notes[noteIndex] = updatedNote;

        await browser.storage.local.set({ timeoutNotes: notes });
        return updatedNote;
    } catch (error) {
        console.error(`Error updating timeout note with ID "${noteId}":`, error);
        return null;
    }
}

/**
 * Deletes a timeout note from storage by its ID.
 *
 * @async
 * @function deleteTimeoutNote
 * @param {string} noteId - The ID of the note to delete.
 * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful,
 *                             false if the note was not found or a storage error occurred.
 */
export async function deleteTimeoutNote(noteId) {
    if (!noteId || typeof noteId !== 'string') {
        console.error("Invalid noteId provided to deleteTimeoutNote.");
        return false;
    }
    try {
        let notes = await getTimeoutNotes();
        const initialLength = notes.length;
        notes = notes.filter(note => note.id !== noteId);

        if (notes.length === initialLength) {
            console.warn(`Note with ID "${noteId}" not found for deletion.`);
            return false;
        }

        await browser.storage.local.set({ timeoutNotes: notes });
        return true;
    } catch (error) {
        console.error(`Error deleting timeout note with ID "${noteId}":`, error);
        return false;
    }
} 