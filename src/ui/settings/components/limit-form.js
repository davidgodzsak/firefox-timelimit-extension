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
    // Create elements safely using DOM methods
    const formHeader = document.createElement('div');
    formHeader.className = 'limit-form-header';

    const siteInfo = document.createElement('div');
    siteInfo.className = 'site-info';
    
    const siteUrl = document.createElement('h4');
    siteUrl.className = 'site-url';
    siteUrl.textContent = this.siteData.urlPattern;
    siteInfo.appendChild(siteUrl);

    const formActions = document.createElement('div');
    formActions.className = 'form-actions';

    // Create toggle switch
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';
    toggleLabel.title = this.siteData.isEnabled ? 'Disable site' : 'Enable site';

    const toggleCheckbox = document.createElement('input');
    toggleCheckbox.type = 'checkbox';
    toggleCheckbox.className = 'toggle-site-checkbox';
    toggleCheckbox.checked = this.siteData.isEnabled;

    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';

    const toggleLabelText = document.createElement('span');
    toggleLabelText.className = 'toggle-label';
    toggleLabelText.textContent = this.siteData.isEnabled ? 'Enabled' : 'Disabled';

    toggleLabel.appendChild(toggleCheckbox);
    toggleLabel.appendChild(toggleSlider);
    toggleLabel.appendChild(toggleLabelText);

    // Create delete button with SVG
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-small delete-site-btn';
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete site';

    const deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    deleteSvg.setAttribute('width', '14');
    deleteSvg.setAttribute('height', '14');
    deleteSvg.setAttribute('viewBox', '0 0 24 24');
    deleteSvg.setAttribute('fill', 'none');
    deleteSvg.setAttribute('stroke', 'currentColor');
    deleteSvg.setAttribute('stroke-width', '2');

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '3,6 5,6 21,6');
    deleteSvg.appendChild(polyline);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2');
    deleteSvg.appendChild(path);

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '10');
    line1.setAttribute('y1', '11');
    line1.setAttribute('x2', '10');
    line1.setAttribute('y2', '17');
    deleteSvg.appendChild(line1);

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '14');
    line2.setAttribute('y1', '11');
    line2.setAttribute('x2', '14');
    line2.setAttribute('y2', '17');
    deleteSvg.appendChild(line2);

    deleteBtn.appendChild(deleteSvg);
    deleteBtn.appendChild(document.createTextNode(' Delete'));

    formActions.appendChild(toggleLabel);
    formActions.appendChild(deleteBtn);

    formHeader.appendChild(siteInfo);
    formHeader.appendChild(formActions);

    // Create form body
    const formBody = document.createElement('div');
    formBody.className = 'limit-form-body';

    const timeLimitRow = document.createElement('div');
    timeLimitRow.className = 'limit-row';
    
    const timeLimitLabel = document.createElement('label');
    timeLimitLabel.className = 'limit-label';
    timeLimitLabel.textContent = 'Time Limit:';
    
    const timeLimitEditor = document.createElement('div');
    timeLimitEditor.className = 'limit-editor';
    timeLimitEditor.id = 'time-limit-editor';

    timeLimitRow.appendChild(timeLimitLabel);
    timeLimitRow.appendChild(timeLimitEditor);

    const openLimitRow = document.createElement('div');
    openLimitRow.className = 'limit-row';
    
    const openLimitLabel = document.createElement('label');
    openLimitLabel.className = 'limit-label';
    openLimitLabel.textContent = 'Open Limit:';
    
    const openLimitEditor = document.createElement('div');
    openLimitEditor.className = 'limit-editor';
    openLimitEditor.id = 'open-limit-editor';

    openLimitRow.appendChild(openLimitLabel);
    openLimitRow.appendChild(openLimitEditor);

    formBody.appendChild(timeLimitRow);
    formBody.appendChild(openLimitRow);

    // Append to container
    this.container.appendChild(formHeader);
    this.container.appendChild(formBody);

    // Get element references
    this.elements.toggleCheckbox = this.container.querySelector(
      '.toggle-site-checkbox'
    );
    this.elements.toggleLabel = this.container.querySelector('.toggle-label');
    this.elements.deleteBtn = this.container.querySelector('.delete-site-btn');
    this.elements.timeLimitEditor =
      this.container.querySelector('#time-limit-editor');
    this.elements.openLimitEditor =
      this.container.querySelector('#open-limit-editor');

    // Setup event listeners
    this.elements.toggleCheckbox.addEventListener('change', () =>
      this.handleToggle()
    );
    this.elements.deleteBtn.addEventListener('click', () =>
      this.handleDelete()
    );
  }

  /**
   * Sets up inline editors for time and open limits.
   * @private
   */
  setupInlineEditors() {
    // Time limit editor
    const timeLimitMinutes =
      this.siteData.dailyLimitSeconds > 0
        ? Math.round(this.siteData.dailyLimitSeconds / 60)
        : 0;

    this.editors.timeLimit = new InlineEditor({
      container: this.elements.timeLimitEditor,
      initialValue:
        timeLimitMinutes > 0 ? timeLimitMinutes.toString() : 'No limit',
      inputType: 'number',
      placeholder: 'Minutes (e.g., 60)',
      inputAttributes: {
        min: '1',
        max: '1440',
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
        },
      },
      onSave: (newValue) => this.handleTimeLimitSave(newValue),
      onCancel: () => console.log('[LimitForm] Time limit edit cancelled'),
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
        max: '100',
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
        },
      },
      onSave: (newValue) => this.handleOpenLimitSave(newValue),
      onCancel: () => console.log('[LimitForm] Open limit edit cancelled'),
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
   * Handles toggle switch change (enable/disable site).
   * @private
   */
  async handleToggle() {
    const newEnabledState = this.elements.toggleCheckbox.checked;

    try {
      this.elements.toggleCheckbox.disabled = true;

      await this.onUpdate(this.siteData.id, { isEnabled: newEnabledState });

      this.siteData.isEnabled = newEnabledState;
      this.updateToggleSwitch();
    } catch (error) {
      console.error('[LimitForm] Error toggling site:', error);
      // Revert checkbox state on error
      this.elements.toggleCheckbox.checked = this.siteData.isEnabled;
    } finally {
      this.elements.toggleCheckbox.disabled = false;
    }
  }

  /**
   * Updates the toggle switch appearance.
   * @private
   */
  updateToggleSwitch() {
    const isEnabled = this.siteData.isEnabled;

    this.elements.toggleCheckbox.checked = isEnabled;
    this.elements.toggleLabel.textContent = isEnabled ? 'Enabled' : 'Disabled';
  }

  /**
   * Handles delete button click.
   * @private
   */
  async handleDelete() {
    const confirmed = confirm(
      `Are you sure you want to delete the limit for ${this.siteData.urlPattern}?`
    );

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
    const timeLimitMinutes =
      this.siteData.dailyLimitSeconds > 0
        ? Math.round(this.siteData.dailyLimitSeconds / 60)
        : 0;
    const timeLimitDisplay =
      timeLimitMinutes > 0 ? `${timeLimitMinutes} min` : 'No limit';
    this.editors.timeLimit.updateValue(timeLimitDisplay);

    const openLimit = this.siteData.dailyOpenLimit || 0;
    const openLimitDisplay = openLimit > 0 ? `${openLimit} opens` : 'No limit';
    this.editors.openLimit.updateValue(openLimitDisplay);

    // Update toggle switch
    this.updateToggleSwitch();
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
