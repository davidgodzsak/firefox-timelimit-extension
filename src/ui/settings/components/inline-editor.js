/**
 * @file inline-editor.js
 * @description Reusable inline editing component for the settings page.
 * Transforms display text into input fields with save/cancel functionality.
 */

/**
 * Creates an inline editor component that can switch between display and edit modes.
 * @class InlineEditor
 */
export class InlineEditor {
  /**
   * Creates an inline editor instance.
   * @param {Object} config - Configuration object
   * @param {HTMLElement} config.container - The container element to attach the editor to
   * @param {string} config.initialValue - The initial value to display/edit
   * @param {string} config.inputType - The type of input ('text', 'number', etc.)
   * @param {Function} config.onSave - Callback function when save is clicked
   * @param {Function} config.onCancel - Callback function when cancel is clicked
   * @param {Object} config.validation - Validation rules
   * @param {string} config.placeholder - Placeholder text for input
   * @param {Object} config.inputAttributes - Additional input attributes
   */
  constructor(config) {
    this.container = config.container;
    this.initialValue = config.initialValue || '';
    this.currentValue = this.initialValue;
    this.inputType = config.inputType || 'text';
    this.onSave = config.onSave || (() => {});
    this.onCancel = config.onCancel || (() => {});
    this.validation = config.validation || {};
    this.placeholder = config.placeholder || '';
    this.inputAttributes = config.inputAttributes || {};
    
    this.isEditing = false;
    this.elements = {};
    
    this.init();
  }
  
  /**
   * Initializes the inline editor component.
   * @private
   */
  init() {
    this.container.classList.add('inline-editor');
    this.createDisplayMode();
    this.createEditMode();
    this.showDisplayMode();
  }
  
  /**
   * Creates the display mode UI.
   * @private
   */
  createDisplayMode() {
    this.elements.displayContainer = document.createElement('div');
    this.elements.displayContainer.className = 'inline-editor-display';
    
    this.elements.displayText = document.createElement('span');
    this.elements.displayText.className = 'inline-editor-text';
    this.elements.displayText.textContent = this.currentValue;
    
    this.elements.editButton = document.createElement('button');
    this.elements.editButton.className = 'inline-editor-edit-btn';
    this.elements.editButton.type = 'button';
    this.elements.editButton.title = 'Edit';
    this.elements.editButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m18 2 4 4-14 14H4v-4L18 2z"/>
        <path d="m14.5 5.5 3 3"/>
      </svg>
    `;
    
    this.elements.editButton.addEventListener('click', () => this.enterEditMode());
    
    this.elements.displayContainer.appendChild(this.elements.displayText);
    this.elements.displayContainer.appendChild(this.elements.editButton);
    this.container.appendChild(this.elements.displayContainer);
  }
  
  /**
   * Creates the edit mode UI.
   * @private
   */
  createEditMode() {
    this.elements.editContainer = document.createElement('div');
    this.elements.editContainer.className = 'inline-editor-edit';
    
    this.elements.input = document.createElement('input');
    this.elements.input.type = this.inputType;
    this.elements.input.className = 'inline-editor-input';
    this.elements.input.value = this.currentValue;
    this.elements.input.placeholder = this.placeholder;
    
    // Apply additional input attributes
    Object.entries(this.inputAttributes).forEach(([key, value]) => {
      this.elements.input.setAttribute(key, value);
    });
    
    this.elements.buttonsContainer = document.createElement('div');
    this.elements.buttonsContainer.className = 'inline-editor-buttons';
    
    this.elements.saveButton = document.createElement('button');
    this.elements.saveButton.className = 'inline-editor-save-btn';
    this.elements.saveButton.type = 'button';
    this.elements.saveButton.title = 'Save';
    this.elements.saveButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
    `;
    
    this.elements.cancelButton = document.createElement('button');
    this.elements.cancelButton.className = 'inline-editor-cancel-btn';
    this.elements.cancelButton.type = 'button';
    this.elements.cancelButton.title = 'Cancel';
    this.elements.cancelButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;
    
    // Event listeners
    this.elements.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.handleCancel();
      }
    });
    
    this.elements.input.addEventListener('input', () => this.validateInput());
    this.elements.saveButton.addEventListener('click', () => this.handleSave());
    this.elements.cancelButton.addEventListener('click', () => this.handleCancel());
    
    this.elements.buttonsContainer.appendChild(this.elements.saveButton);
    this.elements.buttonsContainer.appendChild(this.elements.cancelButton);
    
    this.elements.editContainer.appendChild(this.elements.input);
    this.elements.editContainer.appendChild(this.elements.buttonsContainer);
    this.container.appendChild(this.elements.editContainer);
  }
  
  /**
   * Shows the display mode and hides edit mode.
   * @private
   */
  showDisplayMode() {
    this.elements.displayContainer.style.display = 'flex';
    this.elements.editContainer.style.display = 'none';
    this.isEditing = false;
    this.container.classList.remove('editing');
  }
  
  /**
   * Shows the edit mode and hides display mode.
   * @private
   */
  showEditMode() {
    this.elements.displayContainer.style.display = 'none';
    this.elements.editContainer.style.display = 'flex';
    this.isEditing = true;
    this.container.classList.add('editing');
    
    // Focus the input and select all text
    setTimeout(() => {
      this.elements.input.focus();
      this.elements.input.select();
    }, 0);
  }
  
  /**
   * Enters edit mode.
   */
  enterEditMode() {
    this.elements.input.value = this.currentValue;
    this.showEditMode();
    this.validateInput();
  }
  
  /**
   * Validates the current input value.
   * @private
   * @returns {boolean} Whether the input is valid
   */
  validateInput() {
    const value = this.elements.input.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    // Required validation
    if (this.validation.required && !value) {
      isValid = false;
      errorMessage = 'This field is required';
    }
    
    // Type-specific validation
    if (isValid && this.inputType === 'number') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        isValid = false;
        errorMessage = 'Please enter a valid number';
      } else {
        if (this.validation.min !== undefined && numValue < this.validation.min) {
          isValid = false;
          errorMessage = `Value must be at least ${this.validation.min}`;
        }
        if (this.validation.max !== undefined && numValue > this.validation.max) {
          isValid = false;
          errorMessage = `Value must be at most ${this.validation.max}`;
        }
      }
    }
    
    // Length validation
    if (isValid && this.validation.maxLength && value.length > this.validation.maxLength) {
      isValid = false;
      errorMessage = `Text must be ${this.validation.maxLength} characters or less`;
    }
    
    // Custom validation
    if (isValid && this.validation.custom) {
      const customResult = this.validation.custom(value);
      if (customResult !== true) {
        isValid = false;
        errorMessage = customResult || 'Invalid value';
      }
    }
    
    // Update UI based on validation
    this.elements.input.classList.toggle('invalid', !isValid);
    this.elements.saveButton.disabled = !isValid;
    
    // Show/hide error message
    this.showValidationError(isValid ? '' : errorMessage);
    
    return isValid;
  }
  
  /**
   * Shows or hides validation error message.
   * @private
   * @param {string} message - Error message to show, or empty string to hide
   */
  showValidationError(message) {
    let errorElement = this.elements.editContainer.querySelector('.inline-editor-error');
    
    if (message) {
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'inline-editor-error';
        this.elements.editContainer.appendChild(errorElement);
      }
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    } else if (errorElement) {
      errorElement.style.display = 'none';
    }
  }
  
  /**
   * Handles save button click.
   * @private
   */
  async handleSave() {
    if (!this.validateInput()) {
      return;
    }
    
    const newValue = this.elements.input.value.trim();
    
    try {
      this.elements.saveButton.disabled = true;
      this.elements.saveButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
        </svg>
      `;
      
      await this.onSave(newValue, this.currentValue);
      
      // Update current value and display
      this.currentValue = newValue;
      this.elements.displayText.textContent = newValue;
      this.showDisplayMode();
      
    } catch (error) {
      console.error('[InlineEditor] Error saving value:', error);
      this.showValidationError(error.message || 'Failed to save changes');
    } finally {
      this.elements.saveButton.disabled = false;
      this.elements.saveButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
      `;
    }
  }
  
  /**
   * Handles cancel button click.
   * @private
   */
  handleCancel() {
    this.elements.input.value = this.currentValue;
    this.showDisplayMode();
    this.onCancel();
  }
  
  /**
   * Updates the displayed value.
   * @param {string} newValue - The new value to display
   */
  updateValue(newValue) {
    this.currentValue = newValue;
    this.elements.displayText.textContent = newValue;
    if (this.isEditing) {
      this.elements.input.value = newValue;
    }
  }
  
  /**
   * Gets the current value.
   * @returns {string} The current value
   */
  getValue() {
    return this.currentValue;
  }
  
  /**
   * Destroys the inline editor and removes event listeners.
   */
  destroy() {
    if (this.container.contains(this.elements.displayContainer)) {
      this.container.removeChild(this.elements.displayContainer);
    }
    if (this.container.contains(this.elements.editContainer)) {
      this.container.removeChild(this.elements.editContainer);
    }
    this.container.classList.remove('inline-editor', 'editing');
  }
} 