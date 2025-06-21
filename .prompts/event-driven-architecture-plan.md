LLM Agent Prompt: Refactoring to a Manifest V3 Event-Driven Architecture

Hello! We are about to undertake a significant and critical refactoring of our Firefox browser extension. Your role is to act as an expert AI programmer, specializing in high-quality, test-driven browser extension development.
Primary Goal

Our objective is to migrate the extension's background logic from its current Manifest V2-style architecture (using a persistent main.js orchestrator) to a modern, efficient, and robust event-driven architecture suitable for Manifest V3.
Core Concepts of the New Architecture

    Non-Persistent & Event-Driven: The background script will no longer run continuously. It will be dormant until woken by a specific browser event.
    background.js as the Event Router: We will create a new src/background_scripts/background.js. This file will be the new entry point for all background activity. Its sole purpose is to house the top-level browser API event listeners (tabs.onUpdated, alarms.onAlarm, webNavigation.onBeforeNavigate, etc.) and route those events to the appropriate logic modules.
    chrome.storage as the Single Source of Truth: All extension state (distracting sites, usage data, notes, session info) must be persisted in chrome.storage. Modules should be stateless and operate on data retrieved from storage.
    chrome.alarms for Timers: All time-based operations, specifically usage recording and the daily reset, must be driven by the chrome.alarms API, not setInterval or setTimeout.

General Instructions & Quality Standards

    Adhere to Cursor Rules: First and foremost, you must strictly adhere to all rules defined in .cursor/rules/rules.md.
    Incremental Steps: We will perform this refactor in the distinct steps outlined below. Do not proceed to the next step until I explicitly approve the current one.
    Think Before You Code: For each step, provide a brief plan outlining the files you will create, modify, or delete. After I approve the plan, provide the complete code.
    Test-Driven Development (TDD): This is non-negotiable. For every code change, you must update or create corresponding tests in src/tests/. This includes both unit tests for individual modules and integration tests to ensure the new event-driven flows work correctly. The project must remain fully tested after each step.
    Code Quality: All JavaScript must be clean, modular, and well-documented using JSDoc comments. Use ES6+ modules (import/export) throughout.
    Error Handling: Implement robust error handling using try...catch blocks and structured console logging (e.g., console.error('[ModuleName] Error:', error);).

Step-by-Step Refactoring Plan
Step 1: Create the Event Router and Migrate the Daily Reset

Our first step is to establish the new core and migrate the simplest module.

    Plan:
        Create a new file: src/background_scripts/background.js.
        Modify src/background_scripts/daily_reset.js to export its main reset function.
        In background.js, add logic that runs on extension startup (runtime.onInstalled) to create a single, daily alarm named dailyResetAlarm using chrome.alarms.create().
        Add an alarms.onAlarm listener in background.js. If the alarm's name is dailyResetAlarm, it should call the imported function from daily_reset.js.
        Update the manifest.json to use the new script: "background": { "scripts": ["background_scripts/background.js"] }.
        Update the relevant tests for daily_reset.js to ensure they work in this new asynchronous, alarm-driven context.

Step 2: Migrate the Site Blocker Logic

Next, we'll refactor the site blocker to be a proactive, event-driven check.

    Plan:
        Modify src/background_scripts/site_blocker.js so its blocking logic can be imported and called with a tabId and url.
        In background.js, add a webNavigation.onBeforeNavigate listener.
        This listener will call the site blocker logic, which will internally fetch the blocklist and usage data from storage to determine if the navigation should be redirected to timeout.html.
        Update the unit tests for site_blocker.js and the integration tests to verify this new, immediate blocking flow.

Step 3: Refactor the Usage Recorder (The Core Task)

This is the most complex step. We will replace the old time tracking mechanism with the hybrid alarm-based approach.

    Plan:
        Delete src/background_scripts/tab_activity_monitor.js. Its functionality will be replaced by direct listeners in background.js.
        Refactor src/background_scripts/usage_recorder.js completely. It should no longer manage its own timers. Instead, it will export functions like:
            startTracking(tabId): Stores a tracking_startTime and tracking_tabId in chrome.storage.session.
            stopTracking(): Reads the session data, calculates final duration, updates chrome.storage.local with the total time, and clears the session data.
            updateUsage(): The periodic function called by the alarm. It calculates time since tracking_startTime, updates the total usage in storage, and returns the current total usage for the site.
        In background.js, add listeners for tabs.onUpdated, tabs.onActivated, and windows.onFocusChanged. These listeners will determine if we are entering or leaving a distracting site.
            On entering -> Call usage_recorder.js:startTracking() and create a repeating one-minute alarm named usageTimer.
            On leaving -> Call usage_recorder.js:stopTracking() and clear the usageTimer alarm using chrome.alarms.clear('usageTimer').
        In the alarms.onAlarm listener in background.js, if the alarm name is usageTimer, call usage_recorder.js:updateUsage().
        Thoroughly refactor the tests for usage_recorder.js and the corresponding integration tests to validate this new, robust time-tracking mechanism.

Step 4: Refactor the Badge Manager

The badge should now update based on our new timing events.

    Plan:
        Refactor src/background_scripts/badge_manager.js to simply export an updateBadge(tabId) function. This function will get all necessary data from storage to determine the badge text and color.
        In background.js, call this updateBadge() function whenever time is updated:
            Inside the usageTimer alarm handler (after calling updateUsage).
            After a distracting tab becomes active (tabs.onActivated).
            When navigation to a distracting site is complete (tabs.onUpdated).
        Update the tests for badge_manager.js and the badge system integration tests.

Step 5: Final Cleanup

The final step is to remove the last remnants of the old architecture.

    Plan:
        Delete src/background_scripts/main.js. It has been fully replaced by background.js.
        Review all modules in background_scripts/ to ensure they no longer reference main.js and are fully independent and modular.
        Run all tests one final time to ensure the entire system is stable and working as expected.

Let's begin with Step 1. Please provide your plan for this first step.