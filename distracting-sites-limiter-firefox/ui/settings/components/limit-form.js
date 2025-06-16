/**
 * @file limit-form.js
 * @description Enhanced form component for managing site limits.
 * Supports both time and open count limits with inline editing capabilities.
 */

import { InlineEditor } from './inline-editor.js';

/**
 * Creates an enhanced limit form component with inline editing.
 * @class LimitForm
 */
export class LimitForm {
  /**
   * Creates a limit form instance.
   * @param {Object} config - Configuration object
   * @param {HTMLElement} config.container - The container element to attach the form to
   * @param {Object} config.siteData - The site data object
   * @param {Function} config.onUpdate - Callback function when limits are updated
   * @param {Function} config.onDelete - Callback function when site is deleted
   */
  constructor(config) {
    this.container = config.container;
    this.siteData = config.siteData;
    this.onUpdate = config.onUpdate || (() => {});
    this.onDelete = config.onDelete || (() => {});
    
    this.editors = {};
    this.elements = {};
    
    this.init();
  }
  
  /**
   * Initializes the limit form component.
   * @private
   */
  init() {
    this.container.classList.add('limit-form');
    this.createFormStructure();
    this.setupInlineEditors();
  }
  
  /**
   * Creates the basic form structure.
   * @private
   */
  createFormStructure() {
    this.container.innerHTML = `
      <div class="limit-form-header">
        <div class="site-info">
          <h4 class="site-url">${this.escapeHtml(this.siteData.urlPattern)}</h4>
          <div class="site-status ${this.siteData.isEnabled ? 'enabled' : 'disabled'}">
            ${this.siteData.isEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
        <div class="form-actions">
          <button class="toggle-btn ${this.siteData.isEnabled ? 'enabled' : 'disabled'}" 
                  type="button" title="${this.siteData.isEnabled ? 'Disable' : 'Enable'} site">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${this.siteData.isEnabled 
                ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
                : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
              }
            </svg>
          </button>
          <button class="delete-btn" type="button" title="Delete site">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="limit-form-body">
        <div class="limit-row">
          <label class="limit-label">Time Limit:</label>
          <div class="limit-editor" id="time-limit-editor"></div>
        </div>
        <div class="limit-row">
          <label class="limit-label">Open Limit:</label>
          <div class="limit-editor" id="open-limit-editor"></div>
        </div>
      </div>
    `;
    
    // Get element references
    this.elements.toggleBtn = this.container.querySelector('.toggle-btn');
    this.elements.deleteBtn = this.container.querySelector('.delete-btn');
    this.elements.timeLimitEditor = this.container.querySelector('#time-limit-editor');
    this.elements.openLimitEditor = this.container.querySelector('#open-limit-editor');
    this.elements.siteStatus = this.container.querySelector('.site-status');
    
    // Setup event listeners
    this.elements.toggleBtn.addEventListener('click', () => this.handleToggle());
    this.elements.deleteBtn.addEventListener('click', () => this.handleDelete());
  }
  
  /**
   * Sets up inline editors for time and open limits.
   * @private
   */
  setupInlineEditors() {
    // Time limit editor
    const timeLimitMinutes = this.siteData.dailyLimitSeconds > 0 
      ? Math.round(this.siteData.dailyLimitSeconds / 60) 
      : 0;
    
    this.editors.timeLimit = new InlineEditor({
      container: this.elements.timeLimitEditor,
      initialValue: timeLimitMinutes > 0 ? timeLimitMinutes.toString() : 'No limit',
      inputType: 'number',
      placeholder: 'Minutes (e.g., 60)',
      inputAttributes: {
        min: '1',
        max: '1440'
      },
      validation: {
        required: false,
        min: 1,
        max: 1440,
        custom: (value) => {
          if (!value || value.trim() === '') return true; // Allow empty for "no limit"
          const num = parseInt(value);
          if (isNaN(num)) return 'Please enter a valid number';
          return true;
        }
      },
      onSave: (newValue) => this.handleTimeLimitSave(newValue),
      onCancel: () => console.log('[LimitForm] Time limit edit cancelled')
    });
    
    // Open limit editor
    const openLimit = this.siteData.dailyOpenLimit || 0;
    
    this.editors.openLimit = new InlineEditor({
      container: this.elements.openLimitEditor,
      initialValue: openLimit > 0 ? openLimit.toString() : 'No limit',
      inputType: 'number',
      placeholder: 'Opens (e.g., 5)',
      inputAttributes: {
        min: '1',
        max: '100'
      },
      validation: {
        required: false,
        min: 1,
        max: 100,
        custom: (value) => {
          if (!value || value.trim() === '') return true; // Allow empty for "no limit"
          const num = parseInt(value);
          if (isNaN(num)) return 'Please enter a valid number';
          return true;
        }
      },
      onSave: (newValue) => this.handleOpenLimitSave(newValue),
      onCancel: () => console.log('[LimitForm] Open limit edit cancelled')
    });
  }
  
  /**
   * Handles time limit save.
   * @private
   * @param {string} newValue - The new time limit value
   */
  async handleTimeLimitSave(newValue) {
    const minutes = newValue.trim() === '' ? 0 : parseInt(newValue);
    const seconds = minutes * 60;
    
    const updates = { dailyLimitSeconds: seconds };
    
    try {
      await this.onUpdate(this.siteData.id, updates);
      this.siteData.dailyLimitSeconds = seconds;
      
      // Update display value
      const displayValue = minutes > 0 ? `${minutes} min` : 'No limit';
      this.editors.timeLimit.updateValue(displayValue);
      
    } catch (error) {
      throw new Error(error.message || 'Failed to update time limit');
    }
  }
  
  /**
   * Handles open limit save.
   * @private
   * @param {string} newValue - The new open limit value
   */
  async handleOpenLimitSave(newValue) {
    const opens = newValue.trim() === '' ? 0 : parseInt(newValue);
    
    const updates = opens > 0 ? { dailyOpenLimit: opens } : {};
    
    // If we're removing the open limit, we need to explicitly remove it
    if (opens === 0 && this.siteData.dailyOpenLimit) {
      // We'll set it to undefined to remove it, but the backend should handle this
      updates.dailyOpenLimit = 0;
    }
    
    try {
      await this.onUpdate(this.siteData.id, updates);
      
      if (opens > 0) {
        this.siteData.dailyOpenLimit = opens;
      } else {
        delete this.siteData.dailyOpenLimit;
      }
      
      // Update display value
      const displayValue = opens > 0 ? `${opens} opens` : 'No limit';
      this.editors.openLimit.updateValue(displayValue);
      
    } catch (error) {
      throw new Error(error.message || 'Failed to update open limit');
    }
  }
  
  /**
   * Handles toggle button click (enable/disable site).
   * @private
   */
  async handleToggle() {
    const newEnabledState = !this.siteData.isEnabled;
    
    try {
      this.elements.toggleBtn.disabled = true;
      
      await this.onUpdate(this.siteData.id, { isEnabled: newEnabledState });
      
      this.siteData.isEnabled = newEnabledState;
      this.updateToggleButton();
      
    } catch (error) {
      console.error('[LimitForm] Error toggling site:', error);
      // You could show an error message here
    } finally {
      this.elements.toggleBtn.disabled = false;
    }
  }
  
  /**
   * Updates the toggle button appearance.
   * @private
   */
  updateToggleButton() {
    const isEnabled = this.siteData.isEnabled;
    
    this.elements.toggleBtn.className = `toggle-btn ${isEnabled ? 'enabled' : 'disabled'}`;
    this.elements.toggleBtn.title = `${isEnabled ? 'Disable' : 'Enable'} site`;
    
    this.elements.siteStatus.className = `site-status ${isEnabled ? 'enabled' : 'disabled'}`;
    this.elements.siteStatus.textContent = isEnabled ? 'Enabled' : 'Disabled';
    
    // Update icon
    this.elements.toggleBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${isEnabled 
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
        }
      </svg>
    `;
  }
  
  /**
   * Handles delete button click.
   * @private
   */
  async handleDelete() {
    const confirmed = confirm(`Are you sure you want to delete the limit for ${this.siteData.urlPattern}?`);
    
    if (confirmed) {
      try {
        this.elements.deleteBtn.disabled = true;
        await this.onDelete(this.siteData.id);
      } catch (error) {
        console.error('[LimitForm] Error deleting site:', error);
        // You could show an error message here
      } finally {
        this.elements.deleteBtn.disabled = false;
      }
    }
  }
  
  /**
   * Updates the site data and refreshes the form.
   * @param {Object} newSiteData - The updated site data
   */
  updateSiteData(newSiteData) {
    this.siteData = { ...newSiteData };
    
    // Update editors with new values
    const timeLimitMinutes = this.siteData.dailyLimitSeconds > 0 
      ? Math.round(this.siteData.dailyLimitSeconds / 60) 
      : 0;
    const timeLimitDisplay = timeLimitMinutes > 0 ? `${timeLimitMinutes} min` : 'No limit';
    this.editors.timeLimit.updateValue(timeLimitDisplay);
    
    const openLimit = this.siteData.dailyOpenLimit || 0;
    const openLimitDisplay = openLimit > 0 ? `${openLimit} opens` : 'No limit';
    this.editors.openLimit.updateValue(openLimitDisplay);
    
    // Update toggle button
    this.updateToggleButton();
  }
  
  /**
   * Destroys the limit form and cleans up.
   */
  destroy() {
    // Destroy inline editors
    if (this.editors.timeLimit) {
      this.editors.timeLimit.destroy();
    }
    if (this.editors.openLimit) {
      this.editors.openLimit.destroy();
    }
    
    // Clear container
    this.container.innerHTML = '';
    this.container.classList.remove('limit-form');
  }
  
  /**
   * Escapes HTML entities to prevent XSS.
   * @private
   * @param {string} text - The text to escape
   * @returns {string} The escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
} 