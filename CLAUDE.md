# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Firefox Distraction Limiter is a Firefox extension that helps users limit time spent on distracting websites through monitoring usage and blocking sites when daily limits are reached. The extension features:

- **Event-driven Architecture**: Manifest V3 compatible with non-persistent background scripts
- **Dual Limit System**: Time limits (minutes) and open count limits (site visits)
- **Real-time UI Synchronization**: All components receive live updates via broadcast messaging
- **Modern Testing**: Jest with ES6 modules and comprehensive integration tests

## Common Development Commands

All commands should be run from the `src/` directory:

```bash
cd src

# Testing
yarn test                    # Run all tests
yarn test --coverage        # Run tests with coverage
yarn test path/to/test.js   # Run specific test file

# Code Quality
yarn lint                   # Run ESLint
yarn format                 # Format code with Prettier

# Building
yarn build                  # Build extension (runs lint + test first)
yarn package                # Create distribution package
yarn clean                  # Clean build artifacts
yarn verify-package         # Verify package contents

# Development
yarn prebuild               # Run lint and test (same as build deps)
```

## Architecture

### Core Structure

- **`src/background_scripts/`**: Event-driven background logic
  - `background.js`: Main event router (replaces old main.js)
  - `site_storage.js`: Site configuration management
  - `usage_recorder.js`: Alarm-based time tracking
  - `distraction_detector.js`: Site detection and matching
  - `site_blocker.js`: Real-time site blocking
  - `badge_manager.js`: Toolbar badge updates
  - `daily_reset.js`: Daily usage reset via alarms

- **`src/ui/`**: User interface components
  - `popup/`: Toolbar popup for quick limit setup
  - `settings/`: Full settings page with inline editing
  - `timeout/`: Site blocking/timeout page
  - `common_assets/`: Shared styles and icons

- **`src/tests/`**: Comprehensive test suite
  - `unit/`: Unit tests for all background modules
  - `integration/`: Event-driven architecture integration tests

### Key Patterns

1. **Event-Driven**: Background script uses browser events (alarms, webNavigation, runtime messages)
2. **Stateless Modules**: All state stored in chrome.storage, modules are stateless
3. **Broadcast Updates**: Settings changes trigger immediate updates across all UI components
4. **Alarm-Based Timing**: Uses chrome.alarms API instead of timers for better performance

## Testing

- **Framework**: Jest with ES6 modules
- **Setup**: Uses `jest-webextension-mock` for browser API mocking
- **Coverage**: Unit tests for all background modules + integration tests
- **Run Config**: `NODE_OPTIONS=--experimental-vm-modules jest`

### Test Structure
- Background scripts have corresponding `.test.js` files in `tests/unit/background_scripts/`
- Integration tests cover event-driven architecture and cross-component communication
- Test setup includes browser API mocking and storage simulation

## Code Standards

- **ESLint**: Configured with separate rules for source and test files
- **Prettier**: Auto-formatting for JS, JSON, CSS, MD files
- **ES6 Modules**: All files use import/export syntax
- **Browser APIs**: Extension uses chrome.* APIs with webextension-polyfill fallbacks

## Site Matching

The extension supports flexible URL patterns:
- Domain names: `facebook.com`, `youtube.com`
- Subdomains: `mail.google.com`
- With protocols: `https://twitter.com`

## Limit Types

- **Time Limits**: Minutes (1-1440), tracked via alarms
- **Open Count Limits**: Site visits (1-100), tracked per navigation
- **Combined**: Sites can have both limit types; blocked when ANY limit reached

## Storage Schema

Uses chrome.storage.local with these key patterns:
- `distracting_sites`: Array of site configurations
- `usage_data`: Daily usage tracking data
- `timeout_notes`: Motivational messages for blocked sites
- Cache keys for performance optimization

## Extension Loading

For development in Firefox:
1. Navigate to `about:debugging`
2. Click "This Firefox" 
3. Click "Load Temporary Add-on"
4. Select `src/manifest.json`

## Development Principles

### Code Quality & Architecture
- Always prefer simple solutions over complex ones
- Avoid code duplication - check for similar functionality elsewhere in codebase before implementing
- Keep files under 400-600 lines - refactor when approaching this limit (adjusted for extension complexity)
- Maintain clean codebase organization with clear file and folder structure
- Group imports logically (third-party, then local)
- Preserve existing event-driven architecture patterns

### Extension-Specific Patterns
- **Maintain stateless module design** - All modules should be stateless with chrome.storage as single source of truth
- **Use chrome.alarms over setTimeout/setInterval** - Better performance and Manifest V3 compliance
- **Preserve event-driven architecture** - Background script event routing is core to the design
- **Test background script event handling** - Critical for extension reliability
- **Maintain broadcast messaging patterns** - UI synchronization via message passing

### Change Management
- Be careful - only make requested changes or those you're confident are well understood
- When fixing bugs, exhaust existing implementation options before introducing new patterns
- Focus on code areas relevant to the task - don't touch unrelated code
- Consider what other methods and areas might be affected by code changes
- Don't introduce new patterns/technology without first trying existing implementation

### Security & Data Handling
- Never hard-code sensitive secrets or tokens
- Always validate and sanitize user inputs (leverage existing validation_utils.js)
- Never mock data for dev/prod environments (mocking only for tests)
- Maintain existing security patterns - they exceed typical browser extension requirements

### Documentation & Testing
- Update CHANGELOG.md for major changes using semantic versioning format
- Write documentation for major features in `/docs` folder
- Write thorough tests for all major functionality and edge cases
- Maintain existing comprehensive test coverage (unit + integration)
- Use meaningful error handling with proper categorization

### Deployment & Security
- Never commit or push without approval
- Never commit sensitive information
- Preserve Manifest V3 compliance and minimal permission model

## Performance Notes

- Badge updates are debounced and cached
- Background script is non-persistent (dormant until events)
- Alarm-based operations for better memory efficiency
- Real-time cache invalidation on settings changes