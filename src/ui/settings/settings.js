/**
 * @file settings.js
 * @description JavaScript for the settings page of the Firefox Distraction Limiter extension
 * Handles loading initial data, form submissions, and UI state management
 * Communicates with background scripts via browser.runtime.sendMessage API
 * Enhanced with inline editing components and open count limit support
 */

// Import inline editing components
import { LimitForm } from './components/limit-form.js';

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
        this.limitForms = new Map(); // Track limit form instances
        
        // DOM elements
        this.elements = {
            // Forms
            addSiteForm: document.getElementById('add-site-form'),
            addNoteForm: document.getElementById('add-note-form'),
            
            // Input fields
            siteUrlInput: document.getElementById('site-url'),
            timeLimitInput: document.getElementById('time-limit'),
            openLimitInput: document.getElementById('open-limit'), // NEW: Open limit input
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
            e.target.dataset.submitted = 'true';
            this.handleAddSite();
        });
        
        // Note form submission
        this.elements.addNoteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.target.dataset.submitted = 'true';
            this.handleAddNote();
        });
        
        // Input validation and touch tracking
        this.elements.siteUrlInput.addEventListener('input', this.validateSiteUrl.bind(this));
        this.elements.timeLimitInput.addEventListener('input', this.validateTimeLimit.bind(this));
        this.elements.openLimitInput.addEventListener('input', this.validateOpenLimit.bind(this)); // NEW: Open limit validation
        this.elements.noteTextInput.addEventListener('input', this.validateNoteText.bind(this));
        
        // Track when inputs are touched for validation styling
        [this.elements.siteUrlInput, this.elements.timeLimitInput, this.elements.openLimitInput, this.elements.noteTextInput].forEach(input => {
            input.addEventListener('blur', () => input.classList.add('touched'));
            input.addEventListener('focus', () => {
                // Remove error class on focus to allow fresh validation
                input.classList.remove('error');
            });
        });
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
        const openLimit = parseInt(this.elements.openLimitInput.value); // NEW: Open limit support
        
        // Validate inputs - at least one limit must be specified
        if (!this.validateSiteUrl()) {
            return;
        }
        
        const hasTimeLimit = !isNaN(timeLimit) && timeLimit > 0;
        const hasOpenLimit = !isNaN(openLimit) && openLimit > 0;
        
        if (!hasTimeLimit && !hasOpenLimit) {
            this.showToast('Please specify at least one limit (time or opens).', 'warning');
            return;
        }
        
        if (hasTimeLimit && !this.validateTimeLimit()) {
            return;
        }
        
        if (hasOpenLimit && (openLimit <= 0 || openLimit > 100)) {
            this.showToast('Open limit must be between 1 and 100.', 'warning');
            return;
        }
        
        // Check for duplicates
        if (this.distractingSites.some(site => site.urlPattern.toLowerCase() === urlPattern.toLowerCase())) {
            this.showToast('This site is already in your list.', 'warning');
            return;
        }
        
        try {
            this.showLoading(true);
            
            const payload = {
                urlPattern: urlPattern,
                isEnabled: true
            };
            
            // Add time limit if specified
            if (hasTimeLimit) {
                payload.dailyLimitSeconds = timeLimit * 60; // Convert minutes to seconds
            } else {
                payload.dailyLimitSeconds = 0; // No time limit
            }
            
            // Add open limit if specified
            if (hasOpenLimit) {
                payload.dailyOpenLimit = openLimit;
            }
            
            const response = await browser.runtime.sendMessage({
                action: 'addDistractingSite',
                payload: payload
            });
            
            if (response && response.success) {
                this.distractingSites.push(response.data);
                this.renderSites();
                this.elements.addSiteForm.reset();
                
                // Create descriptive message
                let limitDescription = '';
                if (hasTimeLimit && hasOpenLimit) {
                    limitDescription = `${timeLimit} minute and ${openLimit} open limits`;
                } else if (hasTimeLimit) {
                    limitDescription = `${timeLimit} minute limit`;
                } else {
                    limitDescription = `${openLimit} open limit`;
                }
                
                this.showToast(`Added "${urlPattern}" with ${limitDescription}.`, 'success');
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
                    } else if (error.field === 'dailyOpenLimit') {
                        this.elements.openLimitInput.focus();
                    }
                } else if (error?.type === 'STORAGE_ERROR') {
                    this.showToast(error.message || 'Storage error occurred. Please try again.', 'error');
                } else if (error?.type === 'EXTENSION_CONTEXT_ERROR') {
                    this.showToast(error.message || 'Extension was reloaded. Please refresh this page.', 'error');
                    // Optionally offer to reload the page
                    setTimeout(() => {
                        if (confirm('Would you like to refresh the page now?')) {
                            window.location.reload();
                        }
                    }, 2000);
                } else {
                    this.showToast(error?.message || 'Failed to add site. Please try again.', 'error');
                }
            }
        } catch (error) {
            console.error('[Settings] Error adding site:', error);
            this.showToast('Failed to add site. Please try again.', 'error');
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
     * Handle editing a site (now accepts updates object for flexible editing)
     */
    async handleEditSite(siteId, updates) {
        if (!siteId || !updates || typeof updates !== 'object') {
            console.error('[Settings] Invalid parameters for handleEditSite:', { siteId, updates });
            return;
        }
        
        try {
            this.showLoading(true);
            
            const response = await browser.runtime.sendMessage({
                action: 'updateDistractingSite',
                payload: { id: siteId, updates: updates }
            });
            
            if (response && response.success) {
                // Update local data
                const siteIndex = this.distractingSites.findIndex(site => site.id === siteId);
                if (siteIndex !== -1) {
                    this.distractingSites[siteIndex] = { ...this.distractingSites[siteIndex], ...updates };
                    
                    // Update the limit form with new data
                    const limitForm = this.limitForms.get(siteId);
                    if (limitForm) {
                        limitForm.updateSiteData(this.distractingSites[siteIndex]);
                    }
                }
                
                // Create descriptive message
                let changeDescriptions = [];
                if (updates.dailyLimitSeconds !== undefined) {
                    const minutes = Math.round(updates.dailyLimitSeconds / 60);
                    changeDescriptions.push(`time limit to ${minutes > 0 ? minutes + ' minutes' : 'none'}`);
                }
                if (updates.dailyOpenLimit !== undefined) {
                    changeDescriptions.push(`open limit to ${updates.dailyOpenLimit > 0 ? updates.dailyOpenLimit + ' opens' : 'none'}`);
                }
                if (updates.isEnabled !== undefined) {
                    changeDescriptions.push(`status to ${updates.isEnabled ? 'enabled' : 'disabled'}`);
                }
                
                const site = this.distractingSites[siteIndex];
                const changeMessage = changeDescriptions.length > 0 
                    ? `Updated ${changeDescriptions.join(' and ')}`
                    : 'Updated site';
                
                this.showToast(`${changeMessage} for "${site.urlPattern}".`, 'success');
            } else {
                throw new Error(response?.error?.message || 'Failed to update site');
            }
        } catch (error) {
            console.error('[Settings] Error updating site:', error);
            this.showToast(`Failed to update site: ${error.message}`, 'error');
            throw error; // Re-throw for the limit form to handle
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle deleting a site
     */
    async handleDeleteSite(siteId) {
        if (!siteId) {
            console.error('[Settings] Invalid siteId for handleDeleteSite:', siteId);
            return;
        }
        
        try {
            this.showLoading(true);
            
            const response = await browser.runtime.sendMessage({
                action: 'deleteDistractingSite',
                payload: { id: siteId }
            });
            
            if (response && response.success) {
                // Clean up limit form
                const limitForm = this.limitForms.get(siteId);
                if (limitForm) {
                    limitForm.destroy();
                    this.limitForms.delete(siteId);
                }
                
                // Update local data and re-render
                const site = this.distractingSites.find(site => site.id === siteId);
                this.distractingSites = this.distractingSites.filter(site => site.id !== siteId);
                this.renderSites();
                
                if (site) {
                    this.showToast(`Removed "${site.urlPattern}" from your list.`, 'success');
                } else {
                    this.showToast('Site removed successfully.', 'success');
                }
            } else {
                throw new Error(response?.error?.message || 'Failed to delete site');
            }
        } catch (error) {
            console.error('[Settings] Error deleting site:', error);
            this.showToast(`Failed to delete site: ${error.message}`, 'error');
            throw error; // Re-throw for the limit form to handle
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
        
        // Time limit is now optional - allow empty values
        if (this.elements.timeLimitInput.value.trim() === '') {
            this.elements.timeLimitInput.classList.remove('error');
            return true;
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
     * Validate open limit input
     */
    validateOpenLimit() {
        const openLimit = parseInt(this.elements.openLimitInput.value);
        const errorElement = this.elements.openLimitInput.parentElement.querySelector('.error-message');
        
        // Remove existing error message
        if (errorElement) {
            errorElement.remove();
        }
        
        // Open limit is optional - allow empty values
        if (this.elements.openLimitInput.value.trim() === '') {
            this.elements.openLimitInput.classList.remove('error');
            return true;
        }
        
        if (isNaN(openLimit) || openLimit <= 0) {
            this.showFieldError(this.elements.openLimitInput, 'Open limit must be a positive number');
            return false;
        }
        
        if (openLimit > 100) {
            this.showFieldError(this.elements.openLimitInput, 'Open limit cannot exceed 100');
            return false;
        }
        
        this.elements.openLimitInput.classList.remove('error');
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
        // Clear any existing error messages
        const existingError = inputElement.parentElement.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        if (message) {
            // Only show error styling if the field has been touched or form submitted
            if (inputElement.classList.contains('touched') || inputElement.closest('form').dataset.submitted) {
                inputElement.classList.add('error');
                
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = message;
                errorDiv.style.cssText = `
                    color: var(--accent-error);
                    font-size: var(--font-size-xs);
                    margin-top: var(--spacing-1);
                `;
                
                inputElement.parentElement.appendChild(errorDiv);
            }
            
            // Show toast for the error
            this.showToast(message, 'warning');
            
            // Focus the problematic field
            inputElement.focus();
        } else {
            // Remove error styling
            inputElement.classList.remove('error');
        }
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
     * Create a site item using the enhanced LimitForm component
     */
    createSiteItem(site) {
        const item = document.createElement('div');
        item.className = 'item-card limit-form-container';
        item.role = 'listitem';
        
        // Create LimitForm instance
        const limitForm = new LimitForm({
            container: item,
            siteData: site,
            onUpdate: async (siteId, updates) => {
                await this.handleEditSite(siteId, updates);
            },
            onDelete: async (siteId) => {
                await this.handleDeleteSite(siteId);
            }
        });
        
        // Store the form instance for cleanup later
        this.limitForms.set(site.id, limitForm);
        
        return item;
    }
    
    /**
     * Create a note item DOM element
     */
    createNoteItem(note) {
        const item = document.createElement('div');
        item.className = 'item-card';
        item.role = 'listitem';
        
        // Create elements securely instead of using innerHTML
        const content = document.createElement('div');
        content.className = 'item-content';
        
        const info = document.createElement('div');
        info.className = 'item-info';
        
        const title = document.createElement('div');
        title.className = 'item-title';
        title.textContent = note.text;
        
        const actions = document.createElement('div');
        actions.className = 'item-actions';
        
        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-small edit-note-btn';
        editBtn.setAttribute('data-note-id', note.id);
        editBtn.setAttribute('aria-label', 'Edit note');
        
        const editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        editSvg.setAttribute('width', '14');
        editSvg.setAttribute('height', '14');
        editSvg.setAttribute('viewBox', '0 0 24 24');
        editSvg.setAttribute('fill', 'none');
        editSvg.setAttribute('stroke', 'currentColor');
        editSvg.setAttribute('stroke-width', '2');
        editSvg.setAttribute('stroke-linecap', 'round');
        editSvg.setAttribute('stroke-linejoin', 'round');
        
        const editPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        editPath1.setAttribute('d', 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7');
        const editPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        editPath2.setAttribute('d', 'm18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z');
        
        editSvg.appendChild(editPath1);
        editSvg.appendChild(editPath2);
        editBtn.appendChild(editSvg);
        editBtn.appendChild(document.createTextNode(' Edit'));
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-small delete-note-btn';
        deleteBtn.setAttribute('data-note-id', note.id);
        deleteBtn.setAttribute('aria-label', 'Delete note');
        
        const deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        deleteSvg.setAttribute('width', '14');
        deleteSvg.setAttribute('height', '14');
        deleteSvg.setAttribute('viewBox', '0 0 24 24');
        deleteSvg.setAttribute('fill', 'none');
        deleteSvg.setAttribute('stroke', 'currentColor');
        deleteSvg.setAttribute('stroke-width', '2');
        deleteSvg.setAttribute('stroke-linecap', 'round');
        deleteSvg.setAttribute('stroke-linejoin', 'round');
        
        const deletePolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        deletePolyline.setAttribute('points', '3,6 5,6 21,6');
        const deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        deletePath.setAttribute('d', 'm19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2');
        
        deleteSvg.appendChild(deletePolyline);
        deleteSvg.appendChild(deletePath);
        deleteBtn.appendChild(deleteSvg);
        deleteBtn.appendChild(document.createTextNode(' Delete'));
        
        // Assemble the structure
        info.appendChild(title);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        content.appendChild(info);
        content.appendChild(actions);
        item.appendChild(content);
        
        // Bind event listeners
        editBtn.addEventListener('click', () => this.promptEditNote(note));
        deleteBtn.addEventListener('click', () => this.handleDeleteNote(note.id));
        
        return item;
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
        
        // Create toast icon container
        const iconDiv = document.createElement('div');
        iconDiv.className = 'toast-icon';
        
        // Create SVG icons securely
        const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconSvg.setAttribute('width', '16');
        iconSvg.setAttribute('height', '16');
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.setAttribute('fill', 'none');
        iconSvg.setAttribute('stroke', 'currentColor');
        iconSvg.setAttribute('stroke-width', '2');
        
        // Add icon based on type
        switch (type) {
            case 'success': {
                const successPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                successPolyline.setAttribute('points', '20,6 9,17 4,12');
                iconSvg.appendChild(successPolyline);
                break;
            }
            case 'error': {
                const errorCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                errorCircle.setAttribute('cx', '12');
                errorCircle.setAttribute('cy', '12');
                errorCircle.setAttribute('r', '10');
                const errorLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                errorLine1.setAttribute('x1', '15');
                errorLine1.setAttribute('y1', '9');
                errorLine1.setAttribute('x2', '9');
                errorLine1.setAttribute('y2', '15');
                const errorLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                errorLine2.setAttribute('x1', '9');
                errorLine2.setAttribute('y1', '9');
                errorLine2.setAttribute('x2', '15');
                errorLine2.setAttribute('y2', '15');
                iconSvg.appendChild(errorCircle);
                iconSvg.appendChild(errorLine1);
                iconSvg.appendChild(errorLine2);
                break;
            }
            case 'warning': {
                const warningPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                warningPath.setAttribute('d', 'm21,16-10-17L1,16z');
                const warningLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                warningLine1.setAttribute('x1', '12');
                warningLine1.setAttribute('y1', '9');
                warningLine1.setAttribute('x2', '12');
                warningLine1.setAttribute('y2', '13');
                const warningLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                warningLine2.setAttribute('x1', '12');
                warningLine2.setAttribute('y1', '17');
                warningLine2.setAttribute('x2', '12.01');
                warningLine2.setAttribute('y2', '17');
                iconSvg.appendChild(warningPath);
                iconSvg.appendChild(warningLine1);
                iconSvg.appendChild(warningLine2);
                break;
            }
            case 'info':
            default: {
                const infoCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                infoCircle.setAttribute('cx', '12');
                infoCircle.setAttribute('cy', '12');
                infoCircle.setAttribute('r', '10');
                const infoLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                infoLine1.setAttribute('x1', '12');
                infoLine1.setAttribute('y1', '16');
                infoLine1.setAttribute('x2', '12');
                infoLine1.setAttribute('y2', '12');
                const infoLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                infoLine2.setAttribute('x1', '12');
                infoLine2.setAttribute('y1', '8');
                infoLine2.setAttribute('x2', '12.01');
                infoLine2.setAttribute('y2', '8');
                iconSvg.appendChild(infoCircle);
                iconSvg.appendChild(infoLine1);
                iconSvg.appendChild(infoLine2);
                break;
            }
        }
        
        iconDiv.appendChild(iconSvg);
        
        // Create message paragraph
        const messageParagraph = document.createElement('p');
        messageParagraph.className = 'toast-message';
        messageParagraph.textContent = message;
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Close notification');
        
        const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        closeSvg.setAttribute('width', '14');
        closeSvg.setAttribute('height', '14');
        closeSvg.setAttribute('viewBox', '0 0 24 24');
        closeSvg.setAttribute('fill', 'none');
        closeSvg.setAttribute('stroke', 'currentColor');
        closeSvg.setAttribute('stroke-width', '2');
        
        const closeLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        closeLine1.setAttribute('x1', '18');
        closeLine1.setAttribute('y1', '6');
        closeLine1.setAttribute('x2', '6');
        closeLine1.setAttribute('y2', '18');
        const closeLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        closeLine2.setAttribute('x1', '6');
        closeLine2.setAttribute('y1', '6');
        closeLine2.setAttribute('x2', '18');
        closeLine2.setAttribute('y2', '18');
        
        closeSvg.appendChild(closeLine1);
        closeSvg.appendChild(closeLine2);
        closeBtn.appendChild(closeSvg);
        
        // Assemble the toast
        toast.appendChild(iconDiv);
        toast.appendChild(messageParagraph);
        toast.appendChild(closeBtn);
        
        // Add close handler
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
                throw new Error(response?.error?.message || 'Failed to delete note');
            }
        } catch (error) {
            console.error('[Settings] Error deleting note:', error);
            this.showToast('Failed to delete note. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
}

// Initialize the settings manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
}); 