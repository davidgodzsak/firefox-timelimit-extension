
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