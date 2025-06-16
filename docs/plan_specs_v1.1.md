# Technical Specification: Firefox Distraction Limiter Extension v1.1.0

## Project Overview

This specification outlines the requirements and implementation approach for extending the Firefox Distraction Limiter Extension from v1.0.0 to v1.1.0. The new version adds enhanced user interaction features, toolbar integration, open count limits, and improved UX while maintaining the existing architecture and design principles.

## Version 1.1.0 New Features

### 1. Enhanced Timeout Page with Message Shuffling
- Add a shuffle icon next to motivational messages on the timeout page
- Allow users to click the shuffle icon to display a random motivational note
- Maintain the same visual design and layout of the timeout page

### 2. Toolbar Integration with Popup
- Add a toolbar button with the extension icon
- Create a popup that opens when the toolbar button is clicked
- Popup allows adding time/open limits for the currently active page
- Include a cogwheel icon in the popup that opens the settings page
- Display dynamic text next to toolbar icon showing remaining limits

### 3. Open Count Limiting
- Extend the existing time limit system to support limiting number of page opens
- Allow users to set daily open limits alongside or instead of time limits
- Track and enforce both time and open count limits seamlessly
- Update the blocking logic to check both limit types

### 4. Dynamic Toolbar Badge Text
- Show remaining minutes and/or opens next to toolbar icon
- Display information only for sites where rules are configured
- Show generic icon for sites without rules, with ability to add new rules

### 5. Improved Settings UX
- Replace HTML alert popups for editing time limits with inline editing
- Transform display text into input fields with save/cancel buttons when edit icon is clicked
- Return to display mode after saving with updated values

## Technical Architecture

### Core System Extensions

#### 1. Manifest.json Updates
- Add `"action"` configuration for toolbar button
- Include popup page in `"default_popup"`
- Ensure proper permissions for toolbar functionality

#### 2. Data Schema Extensions

**Site Object Schema (Extended):**
```javascript
{
  id: string,                    // Existing
  urlPattern: string,            // Existing  
  dailyLimitSeconds: number,     // Existing
  dailyOpenLimit?: number,       // NEW: Optional open count limit
  isEnabled: boolean            // Existing
}
```

**Usage Stats Schema (Unchanged):**
The existing usage tracking already captures both time and opens, so no changes needed to the usage statistics data structure.

#### 3. Background Script Extensions

**Main.js Enhancements:**
- Add toolbar action event listener (`browser.action.onClicked`)
- Implement badge text update system for toolbar
- Add new message handlers for popup communication
- Extend site blocking logic to check both time and open limits
- Add periodic badge text updates for active tabs

**New Message API Actions:**
- `getCurrentPageLimitInfo` - Get limit info for active tab URL
- `addQuickLimit` - Add limit for specific URL from popup
- `shuffleTimeoutNote` - Get random motivational note
- `getBadgeInfo` - Get badge text info for specific URL

**Site Blocker Extensions (site_blocker.js):**
- Update `handlePotentialRedirect` to check both time and open limits
- Implement combined limit checking logic
- Maintain backward compatibility with time-only limits

**New Badge Manager (badge_manager.js):**
- Handle toolbar badge text updates
- Calculate and format remaining time/opens display
- Update badge text when tab changes or usage updates
- Clear badge text for non-distracting sites

#### 4. UI Component Extensions

**New Popup Component (/ui/popup/):**
- `popup.html` - Compact popup interface
- `popup.css` - Styling consistent with existing design system
- `popup.js` - Popup logic and background communication

**Popup Features:**
- Display current page URL and existing limits (if any)
- Form to add/edit time and open limits
- Quick action buttons for common limit values
- Cogwheel icon linking to settings page
- Responsive design for different popup sizes

**Timeout Page Enhancements (timeout.js):**
- Add shuffle icon next to motivational message display
- Implement shuffle functionality with smooth transitions
- Maintain accessibility with proper ARIA labels
- Add click handler for shuffle icon

**Settings Page Improvements (settings.js):**
- Replace prompt()-based editing with inline editing components
- Create edit mode UI states for limit modification
- Add save/cancel button functionality
- Implement input validation for inline editing
- Extend form to include open limit fields

### Project Structure Extensions

```
ui/
├── popup/                     # NEW
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── settings/                  # ENHANCED
│   ├── components/            # ENHANCED
│   │   ├── inline-editor.js   # NEW
│   │   └── limit-form.js      # NEW
│   ├── settings.html          # MODIFIED
│   ├── settings.css           # MODIFIED
│   └── settings.js            # MODIFIED
└── timeout/                   # ENHANCED
    ├── timeout.html           # MODIFIED
    ├── timeout.css            # MODIFIED
    └── timeout.js             # MODIFIED

background_scripts/            # ENHANCED
├── badge_manager.js           # NEW
├── main.js                    # MODIFIED
├── site_blocker.js            # MODIFIED
└── (existing files...)
```

### Data Flow and State Management

#### 1. Toolbar Badge Updates
- Tab change events trigger badge text calculation
- Usage updates trigger badge text refresh
- Badge text shows most relevant limit information
- Clear badge for non-distracting sites

#### 2. Popup Communication Flow
1. User clicks toolbar button
2. Popup requests current page limit info via message passing
3. Background script analyzes current tab URL against configured sites
4. Popup displays current limits and allows modifications
5. Popup sends updates back to background script
6. Background script updates storage and refreshes detection cache

#### 3. Inline Editing Flow
1. User clicks edit icon in settings
2. Display text transforms to input field with current value
3. Save/cancel buttons appear
4. On save: validate input, update storage, return to display mode
5. On cancel: restore original display without changes

### UI/UX Design Specifications

#### 1. Popup Design
- **Size:** 320px width, dynamic height (max 500px)
- **Layout:** Single column, compact form design
- **Colors:** Use existing CSS custom properties from variables.css
- **Typography:** Consistent with settings page typography
- **Icons:** SVG icons matching existing style
- **Responsiveness:** Handle different browser zoom levels

#### 2. Timeout Page Shuffle Enhancement
- **Shuffle Icon:** Positioned to the right of motivational message
- **Animation:** Smooth fade transition between messages (300ms)
- **Icon Style:** Consistent SVG icon with hover effects
- **Accessibility:** Proper focus management and screen reader support

#### 3. Settings Inline Editing
- **Edit Mode:** Transform text display to input field with smooth transition
- **Button Layout:** Save and cancel buttons positioned clearly
- **Validation:** Real-time input validation with error states
- **Focus Management:** Proper keyboard navigation between form elements

### Storage and Performance Considerations

#### 1. Storage Impact
- New `dailyOpenLimit` field adds minimal storage overhead
- Existing usage tracking requires no changes
- Badge text calculations should be cached to avoid excessive computation

#### 2. Performance Optimizations
- Cache current tab badge information to reduce repeated calculations
- Debounce badge text updates to avoid excessive DOM manipulation
- Use efficient message passing with minimal payload sizes
- Implement lazy loading for popup content

#### 3. Memory Management
- Clear badge text caches on tab close events
- Properly clean up popup event listeners
- Avoid memory leaks in shuffle animation timers

### Error Handling and Edge Cases

#### 1. Popup Error Handling
- Handle cases where current tab URL cannot be accessed
- Graceful fallback when background script communication fails
- Input validation with clear error messaging
- Handle popup closure during form submission

#### 2. Badge Text Edge Cases
- Handle very long domain names with text truncation
- Manage multiple limit types display in limited space
- Handle rapid tab switching without performance degradation
- Clear badge text when extension is disabled

#### 3. Inline Editing Edge Cases
- Handle network failures during save operations
- Manage concurrent edits from multiple settings tabs
- Validate against conflicting limit configurations
- Handle browser refresh during edit mode

### Testing Strategy

#### 1. Unit Tests Extensions
- Test new limit checking logic with combined time/open limits
- Test badge text calculation functions
- Test popup form validation logic
- Test shuffle functionality with edge cases

#### 2. Integration Tests
- Test popup-to-background communication flow
- Test inline editing save/cancel operations
- Test badge text updates across tab changes
- Test combined limit enforcement scenarios

#### 3. UI/UX Tests
- Test popup responsive design across different browser sizes
- Test inline editing keyboard navigation
- Test shuffle animation performance
- Test accessibility compliance with screen readers

### Migration and Compatibility

#### 1. Data Migration
- Existing site objects without `dailyOpenLimit` remain fully functional
- No migration needed for existing usage statistics
- Graceful handling of mixed limit configurations

#### 2. Backward Compatibility
- All existing functionality remains unchanged
- New features are additive and optional
- Existing settings and data are preserved

#### 3. Feature Rollout
- All new features can be enabled independently
- Graceful degradation if any component fails
- Clear user communication about new capabilities

### Documentation Updates Required

#### 1. User Documentation
- Update README with new toolbar and popup functionality
- Document open count limiting feature
- Explain improved settings editing workflow

#### 2. Developer Documentation
- Document new message API actions
- Update architecture diagrams
- Document badge text calculation logic

#### 3. Change Log
- Document all new features and improvements
- Note any potential breaking changes (none expected)
- Provide migration guidance if needed

## Implementation Priority and Phasing

### Phase 1: Core Infrastructure
1. Extend data schema for open count limits
2. Update site blocking logic for combined limits
3. Add toolbar action configuration to manifest

### Phase 2: Popup Component
1. Create popup UI components
2. Implement popup-background communication
3. Add quick limit addition functionality

### Phase 3: Badge Text System
1. Implement badge text calculation logic
2. Add badge text update triggers
3. Handle tab change and usage update events

### Phase 4: UX Improvements
1. Add shuffle functionality to timeout page
2. Implement inline editing in settings
3. Add open count limit fields to settings forms

### Phase 5: Testing and Polish
1. Comprehensive testing of all new features
2. Performance optimization and edge case handling
3. Accessibility compliance verification
4. Documentation updates


# Implementation Plan

## Phase 1: Core Infrastructure and Data Schema

- [x] Step 1: Extend Data Schema for Open Count Limits

  - **Task**: Update the site storage schema to support daily open count limits alongside existing time limits. Extend the site object structure to include the optional `dailyOpenLimit` field while maintaining backward compatibility with existing data.

  - **Files**: 
    - `distracting-sites-limiter-firefox/background_scripts/site_storage.js`: Add support for `dailyOpenLimit` field in site objects, update validation functions
    - `distracting-sites-limiter-firefox/tests/unit/background_scripts/site_storage.test.js`: Add test cases for new field validation and CRUD operations

  - **Step Dependencies**: None

  - **User Instructions**: None

- [x] Step 2: Update Manifest for Toolbar Integration

  - **Task**: Update manifest.json to include action configuration for toolbar button, add popup page reference, and ensure proper permissions for toolbar functionality.

  - **Files**: 
    - `distracting-sites-limiter-firefox/manifest.json`: Add action configuration with default_popup, update permissions if needed

  - **Step Dependencies**: None

  - **User Instructions**: None

- [x] Step 3: Extend Background Script Message Handling

  - **Task**: Add new message handlers in main.js for popup communication, current page limit info, and quick limit addition. Update the message API to support new actions without breaking existing functionality.

  - **Files**: 
    - `distracting-sites-limiter-firefox/background_scripts/main.js`: Add new message handlers for popup actions
    - `distracting-sites-limiter-firefox/tests/integration/settings_background_interaction.test.js`: Add test cases for new message actions

  - **Step Dependencies**: Step 1

  - **User Instructions**: None

## Phase 2: Enhanced Limit Checking and Blocking Logic

- [x] Step 4: Update Site Blocking Logic for Combined Limits

  - **Task**: Enhance the site blocking system to check both time and open count limits. Update the blocking logic to handle sites with time-only, opens-only, or combined limit configurations.

  - **Files**: 
    - `distracting-sites-limiter-firefox/background_scripts/site_blocker.js`: Update `handlePotentialRedirect` to check both limit types
    - `distracting-sites-limiter-firefox/background_scripts/usage_storage.js`: Add helper functions for limit checking if needed
    - `distracting-sites-limiter-firefox/tests/unit/background_scripts/site_blocker.test.js`: Add test cases for combined limit checking

  - **Step Dependencies**: Step 1, Step 3

  - **User Instructions**: None

- [x] Step 5: Create Badge Manager System

  - **Task**: Implement a new badge manager system that calculates and updates toolbar badge text showing remaining time/opens for the current tab. Handle badge text formatting and tab change events.

  - **Files**: 
    - `distracting-sites-limiter-firefox/background_scripts/badge_manager.js`: New module for badge text management
    - `distracting-sites-limiter-firefox/background_scripts/main.js`: Integrate badge manager with tab activity monitoring
    - `distracting-sites-limiter-firefox/tests/unit/background_scripts/badge_manager.test.js`: Unit tests for badge calculation logic

  - **Step Dependencies**: Step 4

  - **User Instructions**: None

## Phase 3: Popup Component Development

- [x] Step 6: Create Basic Popup Structure

  - **Task**: Create the popup component with HTML structure, CSS styling consistent with the existing design system, and basic JavaScript functionality for displaying current page information.

  - **Files**: 
    - `distracting-sites-limiter-firefox/ui/popup/popup.html`: Popup HTML structure
    - `distracting-sites-limiter-firefox/ui/popup/popup.css`: Popup styling using existing CSS variables
    - `distracting-sites-limiter-firefox/ui/popup/popup.js`: Basic popup JavaScript structure

  - **Step Dependencies**: Step 2, Step 3

  - **User Instructions**: None

- [x] Step 7: Implement Popup Functionality

  - **Task**: Add full popup functionality including current page limit display, form for adding/editing limits, communication with background script, and navigation to settings page via cogwheel icon.

  - **Files**: 
    - `distracting-sites-limiter-firefox/ui/popup/popup.js`: Complete popup logic and background communication
    - `distracting-sites-limiter-firefox/ui/popup/popup.css`: Additional styling for form elements and interactions
    - `distracting-sites-limiter-firefox/manifest.json`: Update web_accessible_resources if needed

  - **Step Dependencies**: Step 6

  - **User Instructions**: None

## Phase 4: Timeout Page Enhancement

- [x] Step 8: Add Shuffle Functionality to Timeout Page

  - **Task**: Add shuffle icon next to motivational messages on the timeout page, implement shuffle functionality with smooth transitions, and ensure accessibility compliance.

  - **Files**: 
    - `distracting-sites-limiter-firefox/ui/timeout/timeout.html`: Add shuffle icon to layout
    - `distracting-sites-limiter-firefox/ui/timeout/timeout.css`: Add styling for shuffle icon and transitions
    - `distracting-sites-limiter-firefox/ui/timeout/timeout.js`: Implement shuffle functionality and animations
    - `distracting-sites-limiter-firefox/background_scripts/main.js`: Add shuffle message handler if needed

  - **Step Dependencies**: None (can be done in parallel with other UI work)

  - **User Instructions**: None

## Phase 5: Settings Page Improvements

- [x] Step 9: Create Inline Editing Components

  - **Task**: Create reusable inline editing components for the settings page that can transform display text into input fields with save/cancel functionality.

  - **Files**: 
    - `distracting-sites-limiter-firefox/ui/settings/components/inline-editor.js`: Reusable inline editing component
    - `distracting-sites-limiter-firefox/ui/settings/components/limit-form.js`: Enhanced form component for limits
    - `distracting-sites-limiter-firefox/ui/settings/settings.css`: Additional styling for inline editing states

  - **Step Dependencies**: None

  - **User Instructions**: None

- [x] Step 10: Integrate Inline Editing in Settings

  - **Task**: Replace HTML alert-based editing with inline editing components in the settings page. Update the settings form to include open count limit fields and integrate with the new inline editing system.

  - **Files**: 
    - `distracting-sites-limiter-firefox/ui/settings/settings.html`: Update HTML structure for inline editing
    - `distracting-sites-limiter-firefox/ui/settings/settings.js`: Replace alert-based editing with inline editing logic
    - `distracting-sites-limiter-firefox/ui/settings/settings.css`: Update styling for new editing interface

  - **Step Dependencies**: Step 9, Step 1

  - **User Instructions**: None

## Phase 6: System Integration and Testing

- [x] Step 11: Integrate Badge System with Tab Management

  - **Task**: Connect the badge manager with tab activity monitoring and usage updates. Ensure badge text updates properly when tabs change, usage is recorded, or limits are modified.

  - **Files**: 
    - `distracting-sites-limiter-firefox/background_scripts/main.js`: Integrate badge updates with tab activity and usage changes
    - `distracting-sites-limiter-firefox/background_scripts/tab_activity_monitor.js`: Add badge update triggers if needed
    - `distracting-sites-limiter-firefox/background_scripts/usage_recorder.js`: Add badge update triggers if needed

  - **Step Dependencies**: Step 5, Step 7

  - **User Instructions**: None

- [x] Step 12: Comprehensive Integration Testing

  - **Task**: Create comprehensive integration tests that cover the interaction between all new components: popup-background communication, badge text updates, combined limit checking, and settings synchronization.

  - **Files**: 
    - `distracting-sites-limiter-firefox/tests/integration/popup_background_interaction.test.js`: New integration test file for popup functionality
    - `distracting-sites-limiter-firefox/tests/integration/badge_system_integration.test.js`: New test file for badge system
    - `distracting-sites-limiter-firefox/tests/integration/combined_limits_integration.test.js`: Test file for combined time/open limits
    - `distracting-sites-limiter-firefox/tests/integration/settings_background_interaction.test.js`: Update existing tests for new functionality

  - **Step Dependencies**: Step 11

  - **User Instructions**: None

## Phase 7: Final Polish and Documentation

- [x] Step 13: Error Handling and Edge Cases

  - **Task**: Implement comprehensive error handling for all new features, including popup communication failures, badge text calculation errors, and inline editing validation. Handle edge cases like rapid tab switching and concurrent edits.

  - **Files**: 
    - `distracting-sites-limiter-firefox/ui/popup/popup.js`: Add error handling and validation
    - `distracting-sites-limiter-firefox/background_scripts/badge_manager.js`: Add error handling for badge calculations
    - `distracting-sites-limiter-firefox/ui/settings/settings.js`: Add error handling for inline editing
    - `distracting-sites-limiter-firefox/background_scripts/validation_utils.js`: Extend validation utilities for new features

  - **Step Dependencies**: Step 12

  - **User Instructions**: None

- [x] Step 14: Performance Optimization and Caching

  - **Task**: Implement performance optimizations including badge text caching, debounced updates, efficient message passing, and memory management for popup and shuffle functionality.

  - **Files**: 
    - `distracting-sites-limiter-firefox/background_scripts/badge_manager.js`: Add caching and debouncing
    - `distracting-sites-limiter-firefox/ui/popup/popup.js`: Optimize popup loading and communication
    - `distracting-sites-limiter-firefox/ui/timeout/timeout.js`: Optimize shuffle animations and memory usage

  - **Step Dependencies**: Step 13

  - **User Instructions**: None

- [x] Step 15: Documentation and Version Updates

  - **Task**: Update all documentation including README, change logs, and inline code documentation. Update version numbers and ensure all new features are properly documented for users and developers.

  - **Files**: 
    - `README.md`: Update with new v1.1.0 features
    - `docs/change_log.md`: Add v1.1.0 changes and improvements
    - `distracting-sites-limiter-firefox/manifest.json`: Update version to 1.1.0
    - `distracting-sites-limiter-firefox/package.json`: Update version to 1.1.0

  - **Step Dependencies**: Step 14

  - **User Instructions**: Test the complete extension functionality before final release. Install and test in a clean Firefox profile to ensure all features work as expected.
