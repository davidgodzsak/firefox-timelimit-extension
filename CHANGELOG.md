# Changelog

All notable changes to the Firefox Distraction Limiter extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.1.0]: https://github.com/davidgodzsak/firefox-timelimit-extension/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/davidgodzsak/firefox-timelimit-extension/releases/tag/v1.0.0 