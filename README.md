# Firefox Distraction Limiter

> A Firefox extension that helps users limit time spent on distracting websites by monitoring usage and blocking sites when daily limits are reached.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/davidgodzsak/firefox-timelimit-extension)

## Features

- 🕒 **Time Monitoring**: Track time spent on specific websites
- ⏰ **Daily Limits**: Set customizable daily time limits for distracting sites
- 🚫 **Site Blocking**: Automatically block sites when daily limits are reached
- 📝 **Motivational Notes**: Display custom motivational messages during timeouts
- ⚙️ **Easy Configuration**: Clean, modern settings interface
- 📊 **Usage Statistics**: View detailed usage analytics
- 🔄 **Daily Reset**: Automatic reset of daily usage counters

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/davidgodzsak/firefox-timelimit-extension.git
   cd firefox-timelimit-extension/distracting-sites-limiter-firefox
   ```

2. Install dependencies:
   ```bash
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
   - Select the `manifest.json` file from the project directory

### Production Package

1. Create a distribution package:
   ```bash
   yarn package
   ```

2. This creates a `.zip` file that can be uploaded to Firefox Add-ons or installed manually.

## Development

### Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- Firefox Developer Edition (recommended)

### Setup

1. Install dependencies:
   ```bash
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
distracting-sites-limiter-firefox/
├── background_scripts/          # Core extension logic
│   ├── main.js                 # Main background script entry point
│   ├── site_storage.js         # Site configuration management
│   ├── usage_recorder.js       # Time tracking functionality
│   ├── usage_storage.js        # Usage data persistence
│   ├── distraction_detector.js # Site detection logic
│   ├── site_blocker.js         # Site blocking functionality
│   ├── tab_activity_monitor.js # Tab activity tracking
│   ├── daily_reset.js          # Daily usage reset
│   ├── note_storage.js         # Motivational notes storage
│   └── validation_utils.js     # Input validation utilities
├── ui/                         # User interface components
│   ├── settings/               # Settings page
│   ├── timeout/                # Timeout/blocking page
│   └── common_assets/          # Shared UI assets
├── assets/                     # Extension assets
│   └── icons/                  # Icon files
├── _locales/                   # Internationalization
│   └── en/                     # English locale
├── tests/                      # Test suite
│   ├── unit/                   # Unit tests
│   └── integration/            # Integration tests
├── dist/                       # Build output
├── manifest.json               # Extension manifest
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

- **Background Scripts**: Complete unit test coverage for all core modules
- **Validation**: Comprehensive validation testing for all user inputs
- **Storage**: Full CRUD operation testing for site and usage data
- **Error Handling**: Extensive error scenario testing

## Configuration

### Site Configuration

Add sites to monitor through the extension settings:

1. Open Firefox preferences
2. Navigate to Extensions
3. Find "Firefox Distraction Limiter"
4. Click "Options"
5. Add sites with their daily time limits

### Supported URL Patterns

- Domain names: `facebook.com`, `youtube.com`
- Subdomains: `mail.google.com`
- With protocols: `https://twitter.com`

### Time Limits

- Minimum: 1 second
- Maximum: 24 hours (86,400 seconds)
- Format: Seconds (e.g., 3600 for 1 hour)

## Permissions

The extension requires the following permissions:

- **storage**: Store site configurations and usage data
- **alarms**: Schedule daily usage resets
- **tabs**: Monitor active tabs for time tracking
- **webNavigation**: Detect site navigation events

## Browser Compatibility

- Firefox 109+ (Manifest V3 support required)
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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Dávid Godzsák**

- GitHub: [@davidgodzsak](https://github.com/davidgodzsak)
- Project: [firefox-timelimit-extension](https://github.com/davidgodzsak/firefox-timelimit-extension)

## Changelog

### v1.0.0 (Current)

- Initial release
- Core time limiting functionality
- Settings interface
- Usage tracking
- Site blocking
- Motivational timeout notes
- Comprehensive test suite

## Known Issues

1. **Array Type Validation**: Arrays pass object type checks but fail field validation (validation_utils.js)
2. **Duplicate URL Patterns**: Site storage allows duplicate URL patterns without validation
3. **Corrupted Storage Handling**: Poor handling of corrupted storage data in some edge cases

## Support

For bug reports and feature requests, please use the [GitHub Issues](https://github.com/davidgodzsak/firefox-timelimit-extension/issues) page. 