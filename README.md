# Firefox Distraction Limiter

> A Firefox extension that helps users limit time spent on distracting websites by monitoring usage and blocking sites when daily limits are reached.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/davidgodzsak/firefox-timelimit-extension)

## Features

### Core Functionality
- 🕒 **Time Monitoring**: Track time spent on specific websites
- ⏰ **Daily Time Limits**: Set customizable daily time limits for distracting sites
- 📊 **Open Count Limits**: Limit the number of times you can visit a site per day (NEW in v1.1.0)
- 🚫 **Smart Blocking**: Automatically block sites when time OR open count limits are reached
- 📝 **Motivational Notes**: Display custom motivational messages during timeouts
- 🔀 **Message Shuffling**: Click shuffle icon to cycle through different motivational messages (NEW in v1.1.0)

### Toolbar Integration (NEW in v1.1.0)
- 🎯 **Popup Interface**: Click toolbar button for quick limit management
- ⚡ **Quick Setup**: Add limits for the current page directly from the popup
- 🏷️ **Dynamic Badge**: See remaining time/opens in the toolbar badge text
- ⚙️ **Settings Access**: Quick access to full settings via cogwheel icon

### Enhanced User Experience
- ✏️ **Inline Editing**: Smooth inline editing in settings (no more popup alerts!)
- 📱 **Responsive Design**: Clean, modern interface that works on all screen sizes
- ♿ **Accessibility**: Full keyboard navigation and screen reader support
- 📊 **Usage Statistics**: View detailed usage analytics
- 🔄 **Daily Reset**: Automatic reset of daily usage counters

### Architecture (NEW in v1.2.0)
- 🏗️ **Event-Driven**: Modern Manifest V3 event-driven architecture for better performance
- ⚡ **Non-Persistent**: Background script runs only when needed, improving memory efficiency
- 🔄 **Real-Time Sync**: All UI components synchronized with live updates
- 🛡️ **Enhanced Security**: Improved permission model and error handling

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/davidgodzsak/firefox-timelimit-extension.git
   cd firefox-timelimit-extension
   ```

2. Install dependencies:
   ```bash
   cd src
   yarn install
   ```

3. Build the extension:
   ```bash
   yarn build
   ```

4. Load the extension in Firefox:
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file from the `src` directory

### Production Package

1. Create a distribution package:
   ```bash
   cd src
   yarn package
   ```

2. This creates a `.zip` file that can be uploaded to Firefox Add-ons or installed manually.

## Usage

### Quick Setup (Toolbar Popup)
1. Navigate to any website
2. Click the Distraction Limiter icon in the toolbar
3. Set time limit (minutes) and/or open count limit
4. Choose from quick presets (15min/3 opens, 30min/5 opens, 1hr/10 opens)
5. Click "Add Limits" to save

### Full Settings
1. Right-click the toolbar icon and select "Options" OR click the cogwheel in the popup
2. Add sites with their daily time and/or open count limits
3. Configure motivational timeout messages
4. View usage statistics

### Limit Types
- **Time Limits**: Maximum time per day (e.g., 30 minutes)
- **Open Count Limits**: Maximum site visits per day (e.g., 5 opens)
- **Combined Limits**: Use both together for comprehensive control
- **Flexible**: Each site can have time-only, opens-only, or both limit types

## Development

### Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- Firefox Developer Edition (recommended)

### Setup

1. Install dependencies:
   ```bash
   cd src
   yarn install
   ```

2. Run tests:
   ```bash
   yarn test
   ```

3. Run linting:
   ```bash
   yarn lint
   ```

4. Format code:
   ```bash
   yarn format
   ```

### Project Structure

```
src/                            # Main source directory (NEW in v1.2.0)
├── background_scripts/          # Event-driven background logic (ENHANCED in v1.2.0)
│   ├── background.js           # Event router replacing main.js (NEW in v1.2.0)
│   ├── site_storage.js         # Site configuration management
│   ├── usage_recorder.js       # Alarm-based time tracking (ENHANCED in v1.2.0)
│   ├── usage_storage.js        # Usage data persistence
│   ├── distraction_detector.js # Site detection logic
│   ├── site_blocker.js         # Event-driven site blocking (ENHANCED in v1.2.0)
│   ├── daily_reset.js          # Alarm-based daily usage reset (ENHANCED in v1.2.0)
│   ├── note_storage.js         # Motivational notes storage
│   ├── badge_manager.js        # Stateless toolbar badge management (ENHANCED in v1.2.0)
│   └── validation_utils.js     # Input validation utilities
├── ui/                         # User interface components
│   ├── popup/                  # Toolbar popup interface (NEW in v1.1.0)
│   │   ├── popup.html          # Popup structure
│   │   ├── popup.css           # Popup styling
│   │   └── popup.js            # Enhanced popup with real-time sync (ENHANCED in v1.2.0)
│   ├── settings/               # Settings page
│   │   ├── components/         # Reusable UI components (ENHANCED in v1.1.0)
│   │   │   ├── inline-editor.js # Inline editing component (NEW in v1.1.0)
│   │   │   └── limit-form.js   # Enhanced form component (NEW in v1.1.0)
│   │   ├── settings.html       # Settings page structure
│   │   ├── settings.css        # Settings styling  
│   │   └── settings.js         # Settings with broadcast updates (ENHANCED in v1.2.0)
│   ├── timeout/                # Timeout/blocking page
│   │   ├── timeout.html        # Timeout page structure
│   │   ├── timeout.css         # Timeout styling
│   │   └── timeout.js          # Enhanced timeout with shuffle (ENHANCED in v1.1.0, v1.2.0)
│   └── common_assets/          # Shared UI assets
│       ├── css/                # Global styles
│       └── images/             # Icon definitions (NEW in v1.2.0)
├── assets/                     # Extension assets
│   └── icons/                  # Icon files
├── _locales/                   # Internationalization
│   └── en/                     # English locale
├── tests/                      # Comprehensive test suite (ENHANCED in v1.2.0)
│   ├── unit/                   # Unit tests for all modules
│   └── integration/            # Integration tests for event-driven architecture
├── manifest.json               # Extension manifest (UPDATED for v1.2.0 architecture)
├── package.json                # Node.js package configuration
└── build.js                    # Build script
```

### Available Scripts

- `yarn test` - Run test suite
- `yarn lint` - Run ESLint
- `yarn format` - Format code with Prettier
- `yarn build` - Build the extension
- `yarn package` - Create distribution package
- `yarn clean` - Clean build artifacts
- `yarn verify-package` - Verify package contents

## Testing

The project uses Jest with ES6 modules for comprehensive testing:

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test --coverage

# Run specific test file
yarn test tests/unit/background_scripts/site_storage.test.js
```

### Test Coverage

- **Background Scripts**: Complete unit test coverage for all core modules including event-driven architecture (ENHANCED in v1.2.0)
- **Event-Driven Integration**: Full testing of alarm-based timing and browser event handling (NEW in v1.2.0)
- **Popup Integration**: Full testing of popup-background communication
- **Combined Limits**: Comprehensive testing of time + open count limit scenarios
- **Validation**: Enhanced validation testing for all user inputs including new limit types
- **Storage**: Full CRUD operation testing for site and usage data
- **Error Handling**: Extensive error scenario testing including popup communication failures and event-driven edge cases (ENHANCED in v1.2.0)
- **Performance**: Testing for badge calculation optimization, memory management, and alarm-based operations (ENHANCED in v1.2.0)

## Configuration

### Site Configuration

Add sites to monitor through multiple methods:

#### Toolbar Popup (Quick Method)
1. Navigate to the site you want to limit
2. Click the Distraction Limiter toolbar icon
3. Set time limit (minutes) and/or open count limit
4. Click "Add Limits"

#### Full Settings Interface
1. Open Firefox preferences → Extensions → Distraction Limiter → Options
2. Add sites with their daily time and/or open count limits
3. Use inline editing to modify existing limits
4. Configure motivational timeout messages

### Supported URL Patterns

- Domain names: `facebook.com`, `youtube.com`
- Subdomains: `mail.google.com`
- With protocols: `https://twitter.com`

### Limit Configuration

#### Time Limits
- Minimum: 1 minute
- Maximum: 24 hours (1440 minutes)
- Format: Minutes in popup, seconds in settings

#### Open Count Limits (NEW)
- Minimum: 1 open
- Maximum: 100 opens per day
- Format: Number of site visits/opens

#### Combination Rules
- Sites can have time-only, opens-only, or both limit types
- Site is blocked when ANY limit is reached
- Existing time-only configurations remain fully compatible

## Permissions

The extension requires the following permissions:

- **storage**: Store site configurations and usage data
- **alarms**: Schedule daily usage resets
- **tabs**: Monitor active tabs for time tracking
- **webNavigation**: Detect site navigation events
- **activeTab**: Access current tab for popup functionality

## Browser Compatibility

- Firefox 112+ (Manifest V3 support required)
- Firefox Developer Edition
- Firefox ESR (latest)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `yarn test`
5. Run linting: `yarn lint`
6. Commit your changes: `git commit -am 'Add feature'`
7. Push to the branch: `git push origin feature-name`
8. Submit a pull request

### Development Guidelines

- Follow ESLint configuration
- Maintain test coverage above 90%
- Use conventional commit messages
- Update documentation for new features
- Test popup functionality across different screen sizes
- Ensure accessibility compliance with ARIA labels

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Dávid Godzsák**

- GitHub: [@davidgodzsak](https://github.com/davidgodzsak)
- Project: [firefox-timelimit-extension](https://github.com/davidgodzsak/firefox-timelimit-extension)

## Changelog

See [CHANGELOG.md](docs/CHANGELOG.md) for detailed version history.

### v1.2.0 (Current) - Major Architecture Overhaul

#### 🏗️ **Complete Event-Driven Refactor**
- **Background Script Migration**: Migrated from `main.js` to event-driven `background.js` architecture
- **Manifest V3 Compliance**: Full adoption of modern browser extension standards
- **Non-Persistent Background**: Background script now dormant until needed, improving memory efficiency
- **Alarm-Based Operations**: All timing operations now use `chrome.alarms` API instead of timers

#### 📁 **Project Reorganization**
- **Source Consolidation**: Moved codebase from `distracting-sites-limiter-firefox/` to `src/`
- **Enhanced Architecture**: Event router pattern with stateless modules
- **Real-Time Sync**: All UI components receive live updates via broadcast messaging

#### 🧪 **Testing & Quality**
- **New Integration Tests**: Comprehensive event-driven architecture testing
- **Enhanced Error Handling**: Better error categorization and recovery
- **Performance Optimization**: Badge caching, debounced updates, memory management
- **Bug Fixes**: Addressed UI issues including invisible save buttons and form interactions

### v1.1.0 - Major Feature Update

#### 🆕 New Features
- **Toolbar Integration**: Quick limit management via popup
- **Open Count Limits**: Limit daily site visits/opens
- **Message Shuffling**: Cycle through motivational messages
- **Dynamic Badge Text**: See remaining limits in toolbar
- **Inline Editing**: Smooth settings editing experience

#### 🔧 Improvements  
- Enhanced blocking logic for combined limits
- Improved performance with badge text caching
- Better error handling and validation
- Accessibility improvements throughout
- Comprehensive test coverage for new features

### v1.0.0 - Initial Release

- Core time limiting functionality
- Settings interface with time limits
- Usage tracking and statistics
- Site blocking with timeout page
- Motivational timeout notes
- Comprehensive test suite

## Known Issues

1. ~~**Badge Text Performance**: Badge calculations may slow down with many configured sites~~ (FIXED in v1.2.0 with caching optimizations)
2. ~~**Popup Responsiveness**: Popup may not render correctly on very small screen resolutions~~ (IMPROVED in v1.2.0)
3. ~~**Settings Save Buttons**: Save buttons in settings may be invisible until hover~~ (FIXED in v1.2.0)
4. **Concurrent Editing**: Multiple settings tabs editing the same site simultaneously may cause conflicts
5. ~~**Extension Context**: Some edge cases with extension context invalidation~~ (IMPROVED in v1.2.0 with better error handling)

Note: Many issues from previous versions have been resolved in v1.2.0 through the architectural improvements and enhanced error handling.

## Support

For bug reports and feature requests, please use the [GitHub Issues](https://github.com/davidgodzsak/firefox-timelimit-extension/issues) page. 