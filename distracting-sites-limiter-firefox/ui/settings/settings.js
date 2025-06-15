/**
 * @file settings.js
 * @description JavaScript for the settings page of the Firefox Distraction Limiter extension
 * Handles loading initial data, form submissions, and UI state management
 * Communicates with background scripts via browser.runtime.sendMessage API
 */

// Ensure browser API is available (compatibility check)
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    // Use Chrome API as fallback
    window.browser = chrome;
}

/**
 * State management for the settings page
 */
class SettingsManager {
    constructor() {
        this.distractingSites = [];
        this.timeoutNotes = [];
        this.isLoading = false;
        
        // DOM elements
        this.elements = {
            // Forms
            addSiteForm: document.getElementById('add-site-form'),
            addNoteForm: document.getElementById('add-note-form'),
            
            // Input fields
            siteUrlInput: document.getElementById('site-url'),
            timeLimitInput: document.getElementById('time-limit'),
            noteTextInput: document.getElementById('note-text'),
            
            // Lists and containers
            sitesList: document.getElementById('sites-list'),
            notesList: document.getElementById('notes-list'),
            sitesEmpty: document.getElementById('sites-empty'),
            notesEmpty: document.getElementById('notes-empty'),
            
            // Counters
            sitesCount: document.getElementById('sites-count'),
            notesCount: document.getElementById('notes-count'),
            
            // UI elements
            loadingOverlay: document.getElementById('loading-overlay'),
            toastContainer: document.getElementById('toast-container')
        };
        
        this.init();
    }
    
    /**
     * Initialize the settings manager
     */
    async init() {
        try {
            this.showLoading(true);
            this.bindEvents();
            await this.loadAllSettings();
            this.renderUI();
            
            // Small delay to ensure UI has rendered before hiding loader
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error('Failed to initialize settings:', error);
            this.showToast('Failed to load settings. Please refresh the page.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Bind event listeners to form elements
     */
    bindEvents() {
        // Site form submission
        this.elements.addSiteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddSite();
        });
        
        // Note form submission
        this.elements.addNoteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddNote();
        });
        
        // Input validation
        this.elements.siteUrlInput.addEventListener('input', this.validateSiteUrl.bind(this));
        this.elements.timeLimitInput.addEventListener('input', this.validateTimeLimit.bind(this));
        this.elements.noteTextInput.addEventListener('input', this.validateNoteText.bind(this));
    }
    
    /**
     * Load all settings from background script
     */
    async loadAllSettings() {
        try {
            console.log('[Settings] Attempting to load all settings...');
            
            // Check if browser API is available
            if (typeof browser === 'undefined' || !browser.runtime) {
                throw new Error('Browser extension API not available');
            }
            
            console.log('[Settings] Sending getAllSettings message to background script...');
            const response = await browser.runtime.sendMessage({
                action: 'getAllSettings'
            });
            
            console.log('[Settings] Received response:', response);
            
            if (response && response.success) {
                this.distractingSites = response.data.distractingSites || [];
                this.timeoutNotes = response.data.timeoutNotes || [];
                console.log('[Settings] Loaded data:', {
                    sites: this.distractingSites.length,
                    notes: this.timeoutNotes.length
                });
            } else {
                // Enhanced error handling
                const error = response?.error;
                if (error?.type === 'EXTENSION_CONTEXT_ERROR') {
                    throw new Error(error.message || 'Extension context invalidated');
                } else if (error?.type === 'STORAGE_ERROR') {
                    throw new Error(error.message || 'Storage error occurred');
                } else {
                    throw new Error(error?.message || 'Failed to load settings - no success response');
                }
            }
        } catch (error) {
            console.error('[Settings] Error loading settings:', error);
            // Show more detailed error information
            if (error.message.includes('Extension context invalidated') || 
                error.message.includes('Extension was reloaded')) {
                throw new Error('Extension was reloaded. Please refresh this page.');
            } else if (error.message.includes('not available')) {
                throw new Error('Extension API not available. Please ensure this is running as an extension.');
            } else if (error.message.includes('Storage error')) {
                throw new Error('Failed to load settings from storage. Please try refreshing the page.');
            } else {
                throw new Error(`Failed to load settings: ${error.message}`);
            }
        }
    }
    
    /**
     * Handle adding a new distracting site
     */
    async handleAddSite() {
        const urlPattern = this.elements.siteUrlInput.value.trim();
        const timeLimit = parseInt(this.elements.timeLimitInput.value);
        
        // Validate inputs
        if (!this.validateSiteUrl() || !this.validateTimeLimit()) {
            return;
        }
        
        // Check for duplicates
        if (this.distractingSites.some(site => site.urlPattern.toLowerCase() === urlPattern.toLowerCase())) {
            this.showToast('This site is already in your list.', 'warning');
            return;
        }
        
        try {
            this.showLoading(true);
            
            const response = await browser.runtime.sendMessage({
                action: 'addDistractingSite',
                payload: {
                    urlPattern: urlPattern,
                    dailyLimitSeconds: timeLimit * 60, // Convert minutes to seconds
                    isEnabled: true
                }
            });
            
            if (response && response.success) {
                this.distractingSites.push(response.data);
                this.renderSites();
                this.elements.addSiteForm.reset();
                this.showToast(`Added "${urlPattern}" with ${timeLimit} minute limit.`, 'success');
            } else {
                // Enhanced error handling based on error type
                const error = response?.error;
                if (error?.type === 'VALIDATION_ERROR') {
                    this.showToast(`Validation error: ${error.message}`, 'error');
                    // Focus on the problematic field if available
                    if (error.field === 'urlPattern') {
                        this.elements.siteUrlInput.focus();
                    } else if (error.field === 'dailyLimitSeconds') {
                        this.elements.timeLimitInput.focus();
                    }
                } else if (error?.type === 'STORAGE_ERROR') {
                    this.showToast(error.message || 'Storage error occurred. Please try again.', 'error');
                } else if (error?.type === 'EXTENSION_CONTEXT_ERROR') {
                    this.showToast(error.message || 'Extension was reloaded. Please refresh this page.', 'error');
                    // Optionally offer to reload the page
                    setTimeout(() => {
                        if (confirm('Would you like to refresh the page now?')) {
                            location.reload();
                        }
                    }, 2000);
                } else {
                    this.showToast(error?.message || 'Failed to add site. Please try again.', 'error');
                }
            }
        } catch (error) {
            console.error('Error adding site:', error);
            if (error.message.includes('Extension context invalidated')) {
                this.showToast('Extension was reloaded. Please refresh this page.', 'error');
            } else {
                this.showToast('Failed to add site. Please try again.', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle adding a new timeout note
     */
    async handleAddNote() {
        const noteText = this.elements.noteTextInput.value.trim();
        
        // Validate input
        if (!this.validateNoteText()) {
            return;
        }
        
        // Check for duplicates
        if (this.timeoutNotes.some(note => note.text.toLowerCase() === noteText.toLowerCase())) {
            this.showToast('This note already exists.', 'warning');
            return;
        }
        
        try {
            this.showLoading(true);
            
            const response = await browser.runtime.sendMessage({
                action: 'addTimeoutNote',
                payload: {
                    text: noteText
                }
            });
            
            if (response && response.success) {
                this.timeoutNotes.push(response.data);
                this.renderNotes();
                this.elements.addNoteForm.reset();
                this.showToast('Note added successfully.', 'success');
            } else {
                // Enhanced error handling based on error type
                const error = response?.error;
                if (error?.type === 'VALIDATION_ERROR') {
                    this.showToast(`Validation error: ${error.message}`, 'error');
                    if (error.field === 'text') {
                        this.elements.noteTextInput.focus();
                    }
                } else if (error?.type === 'STORAGE_ERROR') {
                    this.showToast(error.message || 'Storage error occurred. Please try again.', 'error');
                } else if (error?.type === 'EXTENSION_CONTEXT_ERROR') {
                    this.showToast(error.message || 'Extension was reloaded. Please refresh this page.', 'error');
                    setTimeout(() => {
                        if (confirm('Would you like to refresh the page now?')) {
                            location.reload();
                        }
                    }, 2000);
                } else {
                    this.showToast(error?.message || 'Failed to add note. Please try again.', 'error');
                }
            }
        } catch (error) {
            console.error('Error adding note:', error);
            if (error.message.includes('Extension context invalidated')) {
                this.showToast('Extension was reloaded. Please refresh this page.', 'error');
            } else {
                this.showToast('Failed to add note. Please try again.', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle editing a site's time limit
     */
    async handleEditSite(siteId, newTimeLimit) {
        try {
            this.showLoading(true);
            
            const response = await browser.runtime.sendMessage({
                action: 'updateDistractingSite',
                payload: {
                    id: siteId,
                    updates: {
                        dailyLimitSeconds: newTimeLimit * 60 // Convert minutes to seconds
                    }
                }
            });
            
            if (response && response.success) {
                const siteIndex = this.distractingSites.findIndex(site => site.id === siteId);
                if (siteIndex !== -1) {
                    this.distractingSites[siteIndex] = response.data;
                    this.renderSites();
                    this.showToast('Site updated successfully.', 'success');
                }
            } else {
                throw new Error(response?.error || 'Failed to update site');
            }
        } catch (error) {
            console.error('Error updating site:', error);
            this.showToast('Failed to update site. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle deleting a site
     */
    async handleDeleteSite(siteId) {
        if (!confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
            return;
        }
        
        try {
            this.showLoading(true);
            
            const response = await browser.runtime.sendMessage({
                action: 'deleteDistractingSite',
                payload: { id: siteId }
            });
            
            if (response && response.success) {
                this.distractingSites = this.distractingSites.filter(site => site.id !== siteId);
                this.renderSites();
                this.showToast('Site removed successfully.', 'success');
            } else {
                throw new Error(response?.error || 'Failed to delete site');
            }
        } catch (error) {
            console.error('Error deleting site:', error);
            this.showToast('Failed to delete site. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle editing a note
     */
    async handleEditNote(noteId, newText) {
        try {
            this.showLoading(true);
            
            const response = await browser.runtime.sendMessage({
                action: 'updateTimeoutNote',
                payload: {
                    id: noteId,
                    updates: {
                        text: newText
                    }
                }
            });
            
            if (response && response.success) {
                const noteIndex = this.timeoutNotes.findIndex(note => note.id === noteId);
                if (noteIndex !== -1) {
                    this.timeoutNotes[noteIndex] = response.data;
                    this.renderNotes();
                    this.showToast('Note updated successfully.', 'success');
                }
            } else {
                throw new Error(response?.error || 'Failed to update note');
            }
        } catch (error) {
            console.error('Error updating note:', error);
            this.showToast('Failed to update note. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle deleting a note
     */
    async handleDeleteNote(noteId) {
        if (!confirm('Are you sure you want to delete this note?')) {
            return;
        }
        
        try {
            this.showLoading(true);
            
            const response = await browser.runtime.sendMessage({
                action: 'deleteTimeoutNote',
                payload: { id: noteId }
            });
            
            if (response && response.success) {
                this.timeoutNotes = this.timeoutNotes.filter(note => note.id !== noteId);
                this.renderNotes();
                this.showToast('Note removed successfully.', 'success');
            } else {
                throw new Error(response?.error || 'Failed to delete note');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            this.showToast('Failed to delete note. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Validate site URL input
     */
    validateSiteUrl() {
        const urlPattern = this.elements.siteUrlInput.value.trim();
        const errorElement = this.elements.siteUrlInput.parentElement.querySelector('.error-message');
        
        // Remove existing error message
        if (errorElement) {
            errorElement.remove();
        }
        
        // Basic validation
        if (!urlPattern) {
            this.showFieldError(this.elements.siteUrlInput, 'URL is required');
            return false;
        }
        
        // Enhanced URL validation
        if (urlPattern.length > 2000) {
            this.showFieldError(this.elements.siteUrlInput, 'URL is too long (max 2000 characters)');
            return false;
        }
        
        // Check for dangerous patterns
        const dangerousPatterns = ['javascript:', 'data:', 'file:', 'chrome:', 'moz-extension:'];
        if (dangerousPatterns.some(pattern => urlPattern.toLowerCase().includes(pattern))) {
            this.showFieldError(this.elements.siteUrlInput, 'Invalid URL pattern contains restricted protocol');
            return false;
        }
        
        // Basic hostname validation
        const normalized = urlPattern.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '');
        
        const hostnameRegex = /^[a-z0-9.-]+[a-z0-9]$/;
        if (!hostnameRegex.test(normalized.split('/')[0])) {
            this.showFieldError(this.elements.siteUrlInput, 'Please enter a valid domain (e.g., example.com)');
            return false;
        }
        
        this.elements.siteUrlInput.classList.remove('error');
        return true;
    }
    
    /**
     * Validate time limit input
     */
    validateTimeLimit() {
        const timeLimit = parseInt(this.elements.timeLimitInput.value);
        const errorElement = this.elements.timeLimitInput.parentElement.querySelector('.error-message');
        
        // Remove existing error message
        if (errorElement) {
            errorElement.remove();
        }
        
        if (isNaN(timeLimit) || timeLimit <= 0) {
            this.showFieldError(this.elements.timeLimitInput, 'Time limit must be a positive number');
            return false;
        }
        
        if (timeLimit > 1440) { // 24 hours in minutes
            this.showFieldError(this.elements.timeLimitInput, 'Time limit cannot exceed 24 hours');
            return false;
        }
        
        this.elements.timeLimitInput.classList.remove('error');
        return true;
    }
    
    /**
     * Validate note text input
     */
    validateNoteText() {
        const noteText = this.elements.noteTextInput.value.trim();
        const errorElement = this.elements.noteTextInput.parentElement.querySelector('.error-message');
        
        // Remove existing error message
        if (errorElement) {
            errorElement.remove();
        }
        
        if (!noteText) {
            this.showFieldError(this.elements.noteTextInput, 'Note text is required');
            return false;
        }
        
        if (noteText.length > 1000) {
            this.showFieldError(this.elements.noteTextInput, 'Note text is too long (max 1000 characters)');
            return false;
        }
        
        this.elements.noteTextInput.classList.remove('error');
        return true;
    }
    
    /**
     * Show field-specific error message
     */
    showFieldError(inputElement, message) {
        inputElement.classList.add('error');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            color: #dc2626;
            font-size: 0.875rem;
            margin-top: 0.25rem;
        `;
        
        inputElement.parentElement.appendChild(errorDiv);
    }
    
    /**
     * Render the entire UI
     */
    renderUI() {
        this.renderSites();
        this.renderNotes();
    }
    
    /**
     * Render the sites list
     */
    renderSites() {
        // Update counter
        this.elements.sitesCount.textContent = `${this.distractingSites.length} ${this.distractingSites.length === 1 ? 'site' : 'sites'}`;
        
        // Show/hide empty state
        if (this.distractingSites.length === 0) {
            this.elements.sitesEmpty.style.display = 'block';
            return;
        } else {
            this.elements.sitesEmpty.style.display = 'none';
        }
        
        // Render site items
        const siteItems = this.distractingSites.map(site => this.createSiteItem(site));
        
        // Clear existing items and add new ones
        const existingItems = this.elements.sitesList.querySelectorAll('.item-card');
        existingItems.forEach(item => item.remove());
        
        siteItems.forEach(item => this.elements.sitesList.appendChild(item));
    }
    
    /**
     * Render the notes list
     */
    renderNotes() {
        // Update counter
        this.elements.notesCount.textContent = `${this.timeoutNotes.length} ${this.timeoutNotes.length === 1 ? 'note' : 'notes'}`;
        
        // Show/hide empty state
        if (this.timeoutNotes.length === 0) {
            this.elements.notesEmpty.style.display = 'block';
            return;
        } else {
            this.elements.notesEmpty.style.display = 'none';
        }
        
        // Render note items
        const noteItems = this.timeoutNotes.map(note => this.createNoteItem(note));
        
        // Clear existing items and add new ones
        const existingItems = this.elements.notesList.querySelectorAll('.item-card');
        existingItems.forEach(item => item.remove());
        
        noteItems.forEach(item => this.elements.notesList.appendChild(item));
    }
    
    /**
     * Create a site item DOM element
     */
    createSiteItem(site) {
        const timeInMinutes = Math.round(site.dailyLimitSeconds / 60);
        
        const item = document.createElement('div');
        item.className = 'item-card';
        item.role = 'listitem';
        
        item.innerHTML = `
            <div class="item-content">
                <div class="item-info">
                    <div class="item-title">${this.escapeHtml(site.urlPattern)}</div>
                    <div class="item-subtitle">${timeInMinutes} minute${timeInMinutes !== 1 ? 's' : ''} daily limit</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-small edit-site-btn" data-site-id="${site.id}" aria-label="Edit ${site.urlPattern}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                    </button>
                    <button class="btn btn-danger btn-small delete-site-btn" data-site-id="${site.id}" aria-label="Delete ${site.urlPattern}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        `;
        
        // Bind event listeners
        const editBtn = item.querySelector('.edit-site-btn');
        const deleteBtn = item.querySelector('.delete-site-btn');
        
        editBtn.addEventListener('click', () => this.promptEditSite(site));
        deleteBtn.addEventListener('click', () => this.handleDeleteSite(site.id));
        
        return item;
    }
    
    /**
     * Create a note item DOM element
     */
    createNoteItem(note) {
        const item = document.createElement('div');
        item.className = 'item-card';
        item.role = 'listitem';
        
        item.innerHTML = `
            <div class="item-content">
                <div class="item-info">
                    <div class="item-title">${this.escapeHtml(note.text)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-small edit-note-btn" data-note-id="${note.id}" aria-label="Edit note">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                    </button>
                    <button class="btn btn-danger btn-small delete-note-btn" data-note-id="${note.id}" aria-label="Delete note">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        `;
        
        // Bind event listeners
        const editBtn = item.querySelector('.edit-note-btn');
        const deleteBtn = item.querySelector('.delete-note-btn');
        
        editBtn.addEventListener('click', () => this.promptEditNote(note));
        deleteBtn.addEventListener('click', () => this.handleDeleteNote(note.id));
        
        return item;
    }
    
    /**
     * Prompt user to edit a site's time limit
     */
    promptEditSite(site) {
        const currentMinutes = Math.round(site.dailyLimitSeconds / 60);
        const newMinutes = prompt(`Edit time limit for ${site.urlPattern}:`, currentMinutes);
        
        if (newMinutes !== null) {
            const minutes = parseInt(newMinutes);
            if (!isNaN(minutes) && minutes > 0 && minutes <= 1440) {
                this.handleEditSite(site.id, minutes);
            } else {
                this.showToast('Please enter a valid time limit (1-1440 minutes).', 'warning');
            }
        }
    }
    
    /**
     * Prompt user to edit a note
     */
    promptEditNote(note) {
        const newText = prompt('Edit motivational note:', note.text);
        
        if (newText !== null && newText.trim() !== '') {
            const trimmedText = newText.trim();
            if (trimmedText.length <= 200) {
                this.handleEditNote(note.id, trimmedText);
            } else {
                this.showToast('Note must be 200 characters or less.', 'warning');
            }
        }
    }
    
    /**
     * Show or hide loading overlay
     */
    showLoading(show) {
        console.log(`[Settings] showLoading(${show})`);
        this.isLoading = show;
        
        if (!this.elements.loadingOverlay) {
            console.error('[Settings] Loading overlay element not found!');
            return;
        }
        
        if (show) {
            this.elements.loadingOverlay.classList.remove('hidden');
        } else {
            this.elements.loadingOverlay.classList.add('hidden');
        }
        
        console.log(`[Settings] Loading overlay classes: ${this.elements.loadingOverlay.className}`);
    }
    
    /**
     * Show a toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>',
            error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21,16-10-17L1,16z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <p class="toast-message">${this.escapeHtml(message)}</p>
            <button class="toast-close" aria-label="Close notification">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        
        // Add close handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => toast.remove());
        
        // Auto-remove after 5 seconds
        setTimeout(() => toast.remove(), 5000);
        
        this.elements.toastContainer.appendChild(toast);
    }
    
    /**
     * Escape HTML entities to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the settings manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
}); 