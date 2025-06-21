# Comprehensive Bug Fix Implementation Prompt

You are a senior Firefox extension developer tasked with fixing critical bugs and UI/UX issues in a Firefox distraction limiting extension (v1.1.0). The extension helps users limit time and daily opens on distracting websites through time tracking, site blocking, and motivational timeout pages.

## Project Context & Rules

**Codebase Rules (CRITICAL - Follow .cursor/rules/rules.md):**
- Always prefer simple solutions and avoid code duplication
- Check existing codebase for similar functionality before implementing new patterns
- Make only requested changes - be careful and conservative
- Keep codebase clean and organized
- Avoid files over 200 lines - refactor if needed
- Modularize components with single responsibility
- Maintain clear file/folder structure
- Write thorough tests for major functionality
- Follow Firefox extension best practices
- Never commit sensitive information

**Project Architecture:**
- Background scripts handle core logic (usage tracking, site blocking, storage)
- UI components are modular (popup, settings, timeout)
- Shared CSS variables in `ui/common_assets/css/variables.css`
- Message passing for background-UI communication
- Extension supports both time limits and daily open count limits (v1.1 feature)

## QA Issues to Fix (All 19 Must Be Addressed)

### Critical Functional Issues (Fix First)
1. **Usage tracking broken**: Timeout page doesn't trigger after time spent - usage not being tracked
2. **Limits not updating**: After increasing a site's limit, site remains blocked
3. **Import syntax error**: "import declarations may only appear at top level of a module" in timeout page
4. **Missing new site input**: Popup has no input for adding limits to sites without existing limits

### Popup Design & Functionality Issues  
5. **Design inconsistency**: Popup UI/UX doesn't follow existing app design
6. **Wrong icons**: Sun icon instead of cogwheel for settings button (appears twice in QA list)
7. **Button styling**: Popup buttons don't match settings page edit/delete button design
8. **Missing usage display**: Popup should show current time spent and opens used
9. **Non-functional progress bars**: Progress bars don't show actual usage vs limits
10. **Easy limit bypass**: Popup shouldn't have edit/delete buttons (makes bypassing limits too easy)

### Settings Page Issues
11. **Validation styling**: Input fields show red border validation error before being touched
12. **Inconsistent buttons**: Site entry edit/delete buttons don't match motivational notes buttons style
13. **Layout alignment**: Add note button not inline with input field
14. **Enabled/disabled indicator**: Should be inline badge, not full-width, with better contrast
15. **Disappearing checkmark**: Checkmark button disappears when writing in input field (inline editing issue)

## Implementation Plan

### Phase 1: Critical Functional Fixes

**Step 1: Fix Core Usage Tracking & Blocking**
```
Tasks:
- Investigate usage_recorder.js - ensure time tracking works properly
- Fix site_blocker.js - verify timeout page triggers when limits reached  
- Fix limit change detection - sites should become accessible when limits increased
- Test daily reset functionality
Files: background_scripts/usage_recorder.js, site_blocker.js, daily_reset.js
```

**Step 2: Fix Technical Errors**
```
Tasks:
- Fix import syntax error in timeout page
- Ensure proper ES6 module structure
- Verify manifest.json module configurations
Files: ui/timeout/timeout.js, manifest.json
```

### Phase 2: Popup Redesign

**Step 3: Popup Design Consistency**
```
Tasks:
- Update popup CSS to match settings page design (use existing CSS variables)
- Replace sun icon with cogwheel icon for settings
- Style buttons to match settings page button design
- Ensure responsive design consistency
Files: ui/popup/popup.html, popup.css
Reference: ui/settings/settings.css, ui/common_assets/css/
```

**Step 4: Popup Functionality**
```
Tasks:
- Add form input for new site limits (when site has no existing limits)
- Display current usage (time spent, opens used) alongside limits
- Implement functional progress bars showing usage vs limits
- Remove edit/delete buttons (prevent easy bypassing)
- Add proper form validation
Files: ui/popup/popup.html, popup.js
```

### Phase 3: Settings Page Consistency

**Step 5: Settings Visual Fixes**
```
Tasks:
- Remove red border from untouched input fields
- Make site edit/delete buttons match motivational notes button style
- Convert enabled/disabled indicator to inline badge with better contrast
- Align add note button with input field
Files: ui/settings/settings.css, settings.html
```

**Step 6: Inline Editing Fixes**
```
Tasks:
- Fix disappearing checkmark button during input
- Ensure save/cancel buttons remain visible during editing
- Test keyboard navigation
Files: ui/settings/components/inline-editor.js, settings.js
```

### Phase 4: Integration & Real-time Updates

**Step 7: Progress Bar & Badge Updates**
```
Tasks:
- Fix progress bar calculations in popup (show real usage data)
- Ensure badge text updates when usage changes
- Test real-time updates when limits modified
Files: background_scripts/badge_manager.js, ui/popup/popup.js
```

**Step 8: Cross-Component Integration**
```
Tasks:
- Ensure popup changes reflect in settings and vice versa
- Verify badge text updates when settings change
- Test message passing between components
Files: All UI components and background communication
```

## Implementation Guidelines

### Design Consistency Requirements
1. **Follow existing design system**: Use CSS variables from `ui/common_assets/css/variables.css`
2. **Match button patterns**: Study `ui/settings/settings.css` for proper button styling
3. **Icon consistency**: Use same icon patterns as existing components
4. **Typography**: Follow existing font sizes, weights, and spacing

### Firefox Extension Best Practices
1. **Manifest V2 compliance**: Maintain current manifest structure
2. **Content Security Policy**: Avoid inline scripts/styles
3. **Message passing**: Use browser.runtime.sendMessage/onMessage properly
4. **Storage API**: Use browser.storage.local consistently
5. **Error handling**: Graceful fallbacks for all operations

### Testing Requirements
1. **Test each fix incrementally**: Verify functionality before moving to next issue
2. **Cross-browser testing**: Ensure compatibility with different Firefox versions
3. **User workflow testing**: Complete end-to-end scenarios
4. **Regression testing**: Ensure existing v1.0 functionality still works

### Code Quality Standards
1. **Follow existing patterns**: Don't introduce new patterns without justification
2. **Maintain modularity**: Keep components focused and reusable
3. **Error handling**: Add proper try/catch blocks and user feedback
4. **Documentation**: Update code comments for significant changes

## Expected Outcomes

After completion, verify these outcomes:
- [ ] All 19 QA issues are resolved
- [ ] Core usage tracking and blocking works correctly
- [ ] Popup design matches existing app aesthetic
- [ ] Popup shows usage data and allows adding new limits
- [ ] Settings page has consistent styling across all sections
- [ ] Progress bars and badge text update in real-time
- [ ] No console errors or import issues
- [ ] Cross-component communication works properly
- [ ] No regressions in existing functionality

## Development Process

1. **Start with Phase 1** - Fix critical functional issues first
2. **Use existing tools** - Leverage file search, code reading, and testing capabilities
3. **Follow existing patterns** - Study working components before making changes
4. **Test incrementally** - Verify each fix before proceeding
5. **Document changes** - Note any architectural decisions or pattern modifications

Begin with Phase 1, Step 1 and work through systematically. Each phase builds on the previous one, so complete phases in order.