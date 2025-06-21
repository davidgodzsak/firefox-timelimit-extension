# Firefox Time Limit Extension - QA Issue Resolution Prompt

You are an expert LLM coding agent tasked with fixing critical issues in a Firefox browser extension for time management. You will be implementing fixes for multiple QA-identified problems in a systematic, phase-based approach.

## Project Context

You are working on a **Firefox Time Limit Extension** that helps users manage their browsing time by setting limits on specific websites. The extension includes:
- Background scripts for time tracking and site blocking
- Popup interface for quick access
- Settings page for configuration
- Timeout page shown when limits are exceeded

**IMPORTANT**: This is a fully functional codebase that has been tested. You are fixing specific UX and functionality issues identified during QA testing.

## Your Mission

Fix **ALL** of the following QA-identified problems:

### **QA Problems List:**
1. **Timer Badge Update Issue**: The toolbar icon badge shows remaining time but only updates every 15s - should update every 2 seconds
2. **Missing Timeout Redirect**: When time expires, users are not automatically redirected to timeout page and can stay indefinitely without page refresh
3. **Redundant Site Pattern Input**: Popup asks for site pattern input when it should auto-detect from current tab info
4. **Settings Layout Issue**: Activity suggestion input should be on same line as add note button
5. **Wrong Header Icon**: Settings page header icon should match the app icon from assets/icons folder
6. **Redundant Popup Text**: Popup shows redundant settings text when progress bars are sufficient
7. **Invisible Save Buttons**: Save buttons on settings page are invisible by default, only appear on hover
8. **Redundant Enable/Disable Controls**: Settings page has both button and badge for enable/disable - should use single toggle switch
9. **Premature URL Validation**: URL validation warnings appear while typing instead of on focus loss

## Implementation Plan

Follow this **step-by-step phase-based approach**:

### **Phase 1: Critical Functionality Fixes (HIGH PRIORITY)**

#### Step 1.1: Fix Timer Badge Update Frequency
- Locate badge management in background scripts
- Change update interval from 15s to 2s
- Test performance impact
- Ensure battery usage remains acceptable

#### Step 1.2: Implement Automatic Timeout Redirect
- Find timeout enforcement mechanism
- Add automatic redirect when time limit reached
- Handle edge cases (refresh, navigation)
- Test across different browser states

### **Phase 2: Popup Page UX Improvements (MEDIUM PRIORITY)**

#### Step 2.1: Remove Redundant Site Pattern Input
- Modify popup to auto-extract site from active tab
- Remove manual site pattern input field
- Keep informative title: "{site} No limits configured"
- Update popup workflow

#### Step 2.2: Remove Redundant Settings Information
- Remove redundant text from popup on limited pages
- Ensure progress bars provide sufficient information
- Maintain clean interface

### **Phase 3: Settings Page UI/UX Overhaul (MEDIUM PRIORITY)**

#### Step 3.1: Fix Layout and Visual Issues
- **Activity suggestion**: Move input to same line as add button
- **Header icon**: Use app icon from assets/icons folder
- **Save buttons**: Make visible by default (fix CSS)

#### Step 3.2: Replace Enable/Disable with Toggle Switch
- Remove separate button and badge
- Implement single toggle switch
- Update related functionality

#### Step 3.3: Improve URL Validation UX
- Change validation trigger from real-time to blur event
- Maintain helpful feedback
- Test across input scenarios

### **Phase 4: Testing (CONCURRENT)**
- Test each fix thoroughly
- Perform regression testing
- Verify cross-browser compatibility
- Check performance impact

## Instructions for Implementation

### **1. Understand the Project First**
- **MUST**: Explore the file structure to understand the codebase organization
- **MUST**: Read key files to understand current implementation
- **MUST**: Follow any existing code patterns and conventions
- **MUST**: Use the tools available to examine the project structure

### **2. Follow Cursor Rules**
- Adhere to all coding standards and conventions established in the project
- Use existing patterns and architectures
- Maintain code quality and consistency
- Follow the project's testing patterns

### **3. Implementation Approach**
- **Work through phases in order** - complete Phase 1 before moving to Phase 2
- **Fix one problem at a time** within each phase
- **Test each fix** before moving to the next
- **Document your changes** clearly
- **Maintain backward compatibility**

### **4. File Structure Exploration**
Before starting, explore these key areas:
- `src/background_scripts/` - Timer and blocking logic
- `src/ui/popup/` - Popup interface
- `src/ui/settings/` - Settings page
- `src/ui/timeout/` - Timeout page
- `src/assets/icons/` - App icons
- `src/manifest.json` - Extension configuration

### **5. Quality Requirements**
- **Zero regressions**: Don't break existing functionality
- **Performance conscious**: Especially for timer updates
- **User experience focused**: All changes should improve UX
- **Cross-browser compatible**: Ensure Firefox compatibility
- **Accessible**: Maintain accessibility standards

## Success Criteria

You have successfully completed this task when:
- [ ] All 9 QA problems are completely resolved
- [ ] Timer badge updates every 2 seconds
- [ ] Automatic timeout redirect works reliably
- [ ] Popup auto-detects sites without manual input
- [ ] Settings page layout is clean and functional
- [ ] Icons are consistent throughout the extension
- [ ] Save buttons are properly visible
- [ ] Toggle switch replaces redundant controls
- [ ] URL validation triggers appropriately
- [ ] All existing functionality still works
- [ ] Performance remains acceptable

## Getting Started

1. **First**: Explore the project structure using available tools
2. **Then**: Read the manifest.json and key background scripts to understand architecture
3. **Next**: Begin with Phase 1, Step 1.1 (Timer Badge Update)
4. **Finally**: Work systematically through each phase

Remember: Take time to understand the existing code before making changes. Quality and reliability are more important than speed.