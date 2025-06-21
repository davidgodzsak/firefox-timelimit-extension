# Changelog

All notable changes to the Firefox Distraction Limiter extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-01-09

### 🏗️ Major Architecture Overhaul

This release represents a **fundamental architectural transformation** from Manifest V2-style to a modern, event-driven Manifest V3 architecture, significantly improving performance, reliability, and browser compatibility.

#### 🚀 Event-Driven Architecture Migration
- **Complete Background Script Refactor**: Migrated from persistent `main.js` orchestrator to event-driven `background.js` router
- **Non-Persistent Background**: Background script now dormant until woken by browser events, improving memory efficiency
- **Event Router Pattern**: New `background.js` serves as central event dispatcher for all browser API listeners
- **Stateless Modules**: All background modules redesigned to be stateless, using `chrome.storage` as single source of truth
- **Alarm-Based Timers**: Replaced `setInterval`/`setTimeout` with `chrome.alarms` API for all time-based operations

#### 📁 Project Structure Reorganization
- **Consolidated Source**: Moved entire codebase from `distracting-sites-limiter-firefox/` to `src/` for better organization
- **Cleaner Development**: Simplified build process and development workflow
- **Better Module Organization**: Enhanced separation of concerns across all components

#### 🔧 Core Module Refactoring

**New Event-Driven Background System:**
- `background.js` - Central event router replacing `main.js`
- Enhanced `usage_recorder.js` - Now alarm-based instead of timer-based tracking
- Simplified `badge_manager.js` - Stateless badge updates with storage-based calculations
- Updated `daily_reset.js` - Alarm-driven daily resets
- Improved `site_blocker.js` - Proactive blocking via `webNavigation.onBeforeNavigate`

**Enhanced Browser Integration:**
- `runtime.onInstalled` - Extension initialization and alarm setup
- `alarms.onAlarm` - Handles daily resets and usage updates
- `webNavigation.onBeforeNavigate` - Proactive site blocking
- `tabs.onActivated/onUpdated` - Real-time tab tracking
- `windows.onFocusChanged` - Window focus awareness

#### 🧪 Comprehensive Testing Suite Overhaul
- **New Integration Tests**: Added comprehensive tests for event-driven architecture
  - `core_functionality_fix_verification.test.js` - End-to-end functionality verification
  - `site_blocking_integration.test.js` - Enhanced blocking logic testing
  - `usage_tracking_integration.test.js` - Alarm-based usage tracking tests
- **Updated Unit Tests**: All existing tests refactored for new architecture
- **Performance Testing**: New tests for badge calculation optimization and memory management
- **Error Handling**: Enhanced error scenario testing throughout the system

#### 🎨 Enhanced User Interface
- **Real-Time Synchronization**: All UI components now receive live updates via broadcast messaging
- **Improved Error Handling**: Better error categorization and user feedback across all interfaces
- **Enhanced Popup**: More robust popup-background communication with fallback mechanisms
- **Settings Page**: Better inline editing with improved validation and error states
- **Timeout Page**: Enhanced shuffle functionality with performance optimizations

#### ⚡ Performance & Reliability Improvements
- **Memory Optimization**: Significant reduction in background script memory usage
- **Badge Text Caching**: Optimized badge calculations with intelligent caching
- **Debounced Updates**: Reduced excessive DOM manipulations and API calls
- **Error Recovery**: Better error handling and recovery mechanisms throughout
- **Storage Efficiency**: Optimized storage operations and reduced write frequency


### Technical Details

#### Browser API Migration
- **Manifest V3 Compliance**: Full migration to modern browser extension standards
- **Event-Driven Listeners**: All functionality now triggered by browser events
- **Storage as State**: Complete reliance on `chrome.storage` for state management
- **Improved Permissions**: Optimized permission usage for better security

#### Backward Compatibility
- **Settings Migration**: Existing user configurations seamlessly migrated
- **Data Preservation**: All usage statistics and site configurations retained
- **Feature Parity**: All v1.1.0 features maintained with improved implementation

#### Developer Experience
- **Modern Architecture**: Clean, maintainable event-driven codebase
- **Better Testing**: Comprehensive test coverage for all new patterns
- **Documentation**: Enhanced code documentation and architectural guidelines
- **Build Process**: Streamlined development and packaging workflow

### Browser Compatibility
- **Enhanced Firefox Support**: Improved compatibility with Firefox 112+
- **Future-Proof**: Architecture designed for long-term browser evolution
- **Performance**: Better integration with browser process management

## [1.1.0] - 2025-06-16

### Added

#### 🎯 Toolbar Integration
- **New Popup Interface**: Added toolbar button with popup that opens when clicked
- **Quick Limit Management**: Set time and open count limits directly from the toolbar popup for the current page
- **Settings Access**: Cogwheel icon in popup provides quick access to full settings page
- **Dynamic Badge Text**: Toolbar badge shows remaining time/opens for sites with active limits

#### 📊 Open Count Limiting
- **Daily Open Limits**: Set limits on number of times a site can be opened per day
- **Combined Limits**: Use time limits, open count limits, or both together for comprehensive control
- **Flexible Configuration**: Open count limits are optional and work alongside existing time limits
- **Enhanced Blocking**: Sites are blocked when either time or open count limits are reached

#### ✨ Enhanced User Experience
- **Message Shuffling**: Added shuffle icon on timeout page to cycle through different motivational messages
- **Inline Editing**: Replaced HTML alert popups in settings with smooth inline editing interface
- **Improved Forms**: Enhanced settings forms with save/cancel buttons and real-time validation
- **Responsive Design**: All new UI components work seamlessly across different browser sizes

#### 🏗️ Technical Improvements
- **Badge Manager**: New background service for calculating and updating toolbar badge text
- **Enhanced Storage**: Extended site storage schema to support open count limits while maintaining backward compatibility  
- **Improved Validation**: Enhanced input validation with better error handling and user feedback
- **Performance Optimization**: Cached badge calculations and debounced updates for better performance

### Enhanced

#### ⚙️ Settings Interface
- **Inline Editing**: Transform display text directly into input fields with save/cancel functionality
- **Real-time Validation**: Immediate feedback on input validation errors
- **Keyboard Navigation**: Improved keyboard accessibility throughout the interface
- **Better UX**: Smoother transitions and more intuitive form interactions

#### 🚫 Blocking System
- **Combined Limit Checking**: Site blocker now evaluates both time and open count limits
- **Backward Compatibility**: Existing time-only configurations continue to work seamlessly
- **Enhanced Logic**: More robust blocking logic handles edge cases and concurrent limit types

#### 🔧 Background Scripts
- **Extended Message API**: New message handlers for popup communication and badge updates
- **Improved Error Handling**: Better error handling for popup communication failures and edge cases
- **Memory Management**: Optimized memory usage for badge calculations and popup interactions

### Technical Details

#### New Components
- `ui/popup/` - Complete popup interface with HTML, CSS, and JavaScript
- `background_scripts/badge_manager.js` - Toolbar badge text management system
- `ui/settings/components/inline-editor.js` - Reusable inline editing component
- `ui/settings/components/limit-form.js` - Enhanced form component for limit configuration

#### Updated Components
- `background_scripts/main.js` - Added toolbar action listeners and new message handlers
- `background_scripts/site_blocker.js` - Enhanced with combined limit checking logic
- `background_scripts/site_storage.js` - Extended schema for open count limits
- `ui/timeout/timeout.js` - Added shuffle functionality for motivational messages
- `ui/settings/settings.js` - Replaced alert-based editing with inline editing system

#### Enhanced Testing
- New integration tests for popup-background communication
- Badge system integration testing
- Combined limits testing scenarios
- Performance and error handling test suite

### Browser Compatibility
- Maintains Firefox 112+ compatibility
- All new features work seamlessly with existing Manifest V3 implementation
- Enhanced accessibility compliance with ARIA labels and keyboard navigation

## [1.0.0] - 2024-12-01

### Initial Release

#### Core Features
- 🕒 **Time Monitoring**: Track time spent on specific websites
- ⏰ **Daily Limits**: Set customizable daily time limits for distracting sites  
- 🚫 **Site Blocking**: Automatically block sites when daily limits are reached
- 📝 **Motivational Notes**: Display custom motivational messages during timeouts
- ⚙️ **Easy Configuration**: Clean, modern settings interface
- 📊 **Usage Statistics**: View detailed usage analytics
- 🔄 **Daily Reset**: Automatic reset of daily usage counters

#### Technical Foundation
- Manifest V3 compatibility for Firefox 112+
- Comprehensive background script architecture
- Modern ES6+ module system
- Complete test suite with >90% coverage
- Clean, responsive UI with CSS custom properties
- Efficient storage and performance optimization

#### Browser Support
- Firefox 112+ (Manifest V3 support)
- Firefox Developer Edition
- Firefox ESR (latest)

[1.2.0]: https://github.com/davidgodzsak/firefox-timelimit-extension/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/davidgodzsak/firefox-timelimit-extension/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/davidgodzsak/firefox-timelimit-extension/releases/tag/v1.0.0 