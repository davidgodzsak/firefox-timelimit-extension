<specification_planning>

1.  **Deconstruct the Project Request:**
    * Identified core functionalities: defining distracting sites, setting time limits, monitoring usage (time spent, opens), blocking sites, showing a timeout page, and customizable timeout notes.
    * Noted UI requirements: two main pages (settings, timeout), "well designed trendy," maintainable, and component-swappable.

2.  **Incorporate Project Rules:**
    * Prioritized simplicity in solutions.
    * Emphasized avoiding code duplication through generalization and reusable modules.
    * Stressed clean, organized codebase with small files (under 200 lines).
    * Focused on modular components with single responsibilities.
    * Mandated responsive design, graceful error handling, and input validation.
    * Required clear separation of concerns (e.g., API logic, if any, though this project is client-side).
    * Included requirements for documentation (`/docs`, `change_log.md`) and thorough testing.

3.  **Leverage Starter Template Knowledge:**
    * Understood the context of WebExtensions development using the Mozilla Developer Network (MDN) documentation as a base. This implies using `manifest.json`, background scripts, content scripts (if needed), and UI pages (HTML/CSS/JS).

4.  **Outline Key Specification Sections:** Based on standard software engineering practices and the project's needs, I decided on the following structure for the specification:
    * Introduction & Goals
    * Tech Stack
    * System Architecture
    * Project Structure
    * Detailed Feature Specifications (broken down by module/area)
    * Component Architecture
    * Data Flow & State Management
    * UI/UX Design Considerations
    * API Design (Internal Extension Communication)
    * Error Handling & Logging
    * Testing Strategy
    * Security Considerations
    * Future Extensibility
    * Build & Deployment (briefly)
    * Documentation

5.  **Flesh out each section:**

    * **UI/UX:**
        * Detailed the two main pages (Settings, Timeout).
        * For Settings: management of distracting sites (URL, time limit) and timeout notes.
        * For Timeout Page: display of block message and a random motivational note.
        * Addressed "trendy" by specifying a clean, modern, and intuitive aesthetic, suggesting minimalism. Responsive design was highlighted.

    * **Inputs:** Listed all user-provided data (site URLs, time limits, notes) and browser events (navigation, tab activity).

    * **Core System Architecture & Key Workflows:**
        * **Background Script:** Central nervous system. Handles site list management, time tracking, limit enforcement, blocking (redirection), and communication with UI pages. Utilizes WebExtension APIs like `tabs`, `webNavigation`, `storage`, and `alarms`.
        * **Settings Page (Options UI or Popup):** User interface for configuration. Communicates with the background script for data persistence.
        * **Timeout Page:** Static page displayed upon blocking, dynamically populates content (blocked site URL, motivational note) by querying the background script.

    * **Project Structure & Organization:**
        * Proposed a directory structure that separates concerns (background scripts, UI elements, shared libraries, assets, docs, tests).
        * This structure aids maintainability, scalability, and adheres to the "files under 200 lines" rule by encouraging modularity.

    * **Decoupling Parts:**
        * **Storage Abstraction:** `storage_manager.js` to encapsulate all `browser.storage.local` operations, making it easier to modify or mock.
        * **Modular Logic:** Separate modules for `time_tracker.js`, `site_blocker.js`, promoting single responsibility and testability.
        * **UI Components:** Advocated for small, reusable UI components for the settings page.

    * **Detailed Feature Specifications:** This would be where each user story/feature is broken down into specific technical requirements (e.g., "User can add a distracting site" would detail input fields, validation, storage interaction). The plan is to create placeholders and then fill them.

    * **Data Storage & Schema Design:**
        * Selected `browser.storage.local`.
        * Defined schemas for `distractingSites` (id, urlPattern, dailyLimitSeconds), `timeoutNotes` (id, text), and `usageStats` (date-keyed object mapping site IDs to timeSpentSeconds and opens).
        * Designed the schema with future extensibility in mind (e.g., adding `limitType` and `dailyOpenLimit` to `distractingSites`).

    * **Server Actions & Integrations:** Determined as not applicable for this client-side extension.

    * **Design System & Component Architecture:**
        * Reiterated "clean, modern" design.
        * Proposed a component-based approach for the UI, even if custom-built with plain JS, to meet maintainability and swappability goals. Listed example components like `SiteListItem`, `AddSiteForm`.

    * **Data Flow & State Management:**
        * Outlined how data moves between the background script (source of truth for persisted data and ongoing tracking) and UI elements (settings, timeout page) using `runtime.sendMessage` and `runtime.onMessage`.
        * Usage tracking updates storage, which is then read for limit enforcement.

    * **Testing Strategy:**
        * Proposed a multi-layered approach:
            * **Unit Tests:** For individual modules (storage, time tracker, blocker) using Jest/Mocha and WebExtension API mocks.
            * **Integration Tests:** For interactions between modules and message passing.
            * **Manual E2E Tests:** Covering user workflows.

    * **Future Extensibility:** Specifically addressed how the design (modular architecture, flexible data schema) supports future changes like different limit types (e.g., number of opens) or different timeout screens. The key is abstraction of the limiting logic and potentially making the timeout page destination configurable or its content more dynamic.

6.  **Refinement and Rule Adherence:**
    * Reviewed the entire plan against the project rules, ensuring points like simplicity, no duplication, clean code, modularity, error handling, input validation, and documentation were consistently addressed.
    * Decided on plain JavaScript, HTML, and CSS as the default, with a cautious note about lightweight UI libraries only if they provide significant benefits for "trendiness" and component maintainability without over-complicating.
    * Emphasized the use of `async/await` for cleaner asynchronous code with WebExtension APIs.
    * Noted the importance of `manifest.json`.

This systematic approach ensures all requirements and constraints are considered, leading to a comprehensive and actionable technical specification.
</specification_planning>

## Technical Specification: Firefox Distraction Limiter Extension

**Version:** 1.0
**Date:** 2025-05-13
**Project Lead:** Software Architect AI (Gemini)

**1. Introduction & Goals**

This document outlines the technical specifications for a Firefox browser extension designed to help users limit time spent on distracting websites. The extension will allow users to define a list of distracting sites, set daily time limits for each, monitor their usage, and block access to these sites once the allocated time is exceeded, redirecting to a user-configurable motivational timeout page.

The primary goals are:
* Provide users with effective tools to manage their online distractions.
* Offer a simple, intuitive user interface for configuration.
* Ensure the extension is performant and reliable.
* Build a maintainable and extensible codebase, allowing for future feature additions or modifications to existing components (e.g., different limiting mechanisms or timeout screens).

**2. Tech Stack**

* **Core:**
    * HTML5
    * CSS3
    * JavaScript (ES6+ features, including `async/await`)
* **Browser Integration:**
    * Firefox WebExtensions API (`browser` namespace)
* **Development & Tooling:**
    * **Manifest Version:** V3 (if V2 is still supported by Firefox and preferred for specific reasons, this needs to be stated, but V3 is generally the future). Assuming V3 for stricter permissions and service worker model (though background scripts are still primary for Firefox).
    * **Package Management:** npm or yarn (for managing linters, formatters, testing tools).
    * **Linting:** ESLint with a standard JavaScript style guide (e.g., Airbnb-base, StandardJS, or custom).
    * **Formatting:** Prettier.
    * **Testing:** Jest or Mocha/Chai for unit and integration tests.
* **UI Frameworks:**
    * No specific JavaScript UI framework (e.g., React, Vue, Angular) is prescribed to maintain simplicity. UI components will be built using plain JavaScript, HTML, and CSS.
    * If a "trendy" UI requires more complex component management, a lightweight library (e.g., Preact, Svelte, or native Web Components) might be considered, but this must be justified against the simplicity rule and maintainability benefits.
* **CSS:**
    * Plain CSS, possibly with CSS Custom Properties for theming and consistency.
    * Consider a minimalist utility-first CSS approach if it aids in rapid development of a "trendy" UI without full framework overhead.

**3. System Architecture**

The extension will consist of the following main parts:

* **Manifest File (`manifest.json`):**
    * Defines the extension's properties, permissions, background scripts, UI pages, icons, etc.
    * **Permissions:** `storage`, `tabs`, `webNavigation`, `alarms`. Potentially `activeTab` if specific interactions require it, but broad host permissions will be avoided unless strictly necessary for URL matching. For matching all URLs for distraction checking, `<all_urls>` might be needed for `webNavigation` or dynamic content script injection, but this should be minimized if possible by more targeted matching.
* **Background Scripts:** The core logic resides here.
    * `main.js`: Entry point, initializes other modules, manages overall extension state.
    * `storage_manager.js`: Handles all interactions with `browser.storage.local` (CRUD operations for settings and usage data).
    * `time_tracker.js`: Monitors user activity on tabs, tracks time spent on designated distracting sites, and logs daily usage.
    * `site_blocker.js`: Enforces time limits. When a limit is reached, it redirects the tab to the timeout page. Handles URL matching logic.
    * `daily_reset.js`: (Potentially part of `time_tracker.js` or `main.js`) Uses the `browser.alarms` API to reset daily time usage statistics.
* **UI Pages:**
    * **Settings Page (`ui/settings/settings.html`):**
        * Allows users to add, edit, and delete distracting sites and their time limits.
        * Allows users to add, edit, and delete motivational notes for the timeout page.
        * Communicates with background scripts via `browser.runtime.sendMessage` to load and save data.
        * This can be implemented as a browser action popup or a dedicated options page. An options page offers more space and is generally better for complex settings.
    * **Timeout Page (`ui/timeout/timeout.html`):**
        * A static HTML page displayed when a user attempts to access a blocked site after the time limit has expired.
        * `timeout.js` will fetch the blocked URL (passed as a query parameter) and a random motivational note from storage (via background script) to display.
* **Content Scripts (Optional):**
    * Not planned for the initial version to maintain simplicity. If future features require more direct interaction with web page content (beyond URL checking and redirection), they might be introduced.

**Diagram (Conceptual):**
```
+---------------------+     +---------------------+     +----------------------+
|    Settings UI      |<--->| Background Scripts  |<--->|   Browser Storage    |
| (settings.html, .js)|     | (main, storage,     |     | (browser.storage.local)|
+---------------------+     |  time_tracker,      |     +----------------------+
                            |  site_blocker)      |
+---------------------+     +---------------------+
|    Timeout UI       |<--->|                     |
| (timeout.html, .js) |     |                     |
+---------------------+     +---------------------+
        ^                     |         ^
        | (Redirection)       | (URL Monitoring, Tab Control)
        |                     |         |
        +---------------------|---------+
                              |
                        +-----------+
                        | Browser   |
                        | (Tabs, Nav) |
                        +-----------+
```

**4. Project Structure**

```
/distracting-sites-limiter-firefox
|-- /_locales               // For internationalization (e.g., en/messages.json)
|-- /background_scripts
|   |-- main.js             // Main background service worker/script
|   |-- storage_manager.js  // Manages data persistence
|   |-- time_tracker.js     // Tracks time spent on sites
|   |-- site_blocker.js     // Handles site blocking and redirection
|   |-- daily_reset.js      // Handles daily reset of usage stats
|-- /ui
|   |-- /settings
|   |   |-- settings.html
|   |   |-- settings.js
|   |   |-- settings.css
|   |   |-- /components     // Reusable JS/HTML components for settings
|   |   |   |-- site_list_item.js // Component for displaying/editing a site
|   |   |   |-- note_list_item.js // Component for displaying/editing a note
|   |-- /timeout
|   |   |-- timeout.html
|   |   |-- timeout.js
|   |   |-- timeout.css
|   |-- /common_assets
|       |-- /css
|       |   |-- global.css      // Global styles, variables
|       |   |-- variables.css
|       |-- /images             // Shared images
|-- /assets
|   |-- /icons
|   |   |-- icon-16.png
|   |   |-- icon-32.png
|   |   |-- icon-48.png
|   |   |-- icon-128.png
|-- /lib                      // Shared utility functions (e.g., utils.js for URL parsing)
|-- /docs
|   |-- README.md
|   |-- change_log.md
|   |-- architecture.md       // (Optional: Detailed architecture decisions)
|   |-- feature_X_doc.md    // Documentation for major features
|-- /tests
|   |-- /unit
|   |   |-- background_scripts
|   |   |   |-- storage_manager.test.js
|   |   |   |-- time_tracker.test.js
|   |   |   |-- site_blocker.test.js
|   |   |-- lib
|   |   |   |-- utils.test.js
|   |-- /integration
|   |   |-- settings_background_interaction.test.js
|   |-- setup.js              // Test setup, mock browser APIs
|   |-- jest.config.js        // Or similar for Mocha
|-- manifest.json
|-- package.json
|-- .eslintrc.json
|-- .prettierrc.json
|-- .gitignore
```
* **File Size Limit:** Adhere strictly to the rule of keeping files under 200 lines of code. Refactor larger files into smaller, focused modules.

**5. Detailed Feature Specifications**

**5.1. Core Logic (Background Scripts)**

* **5.1.1. Site Monitoring & Time Tracking (`time_tracker.js`)**
    * Listen to `browser.tabs.onActivated` and `browser.tabs.onUpdated` events.
    * When a tab becomes active or its URL changes, check if the URL matches any pattern in the `distractingSites` list from storage.
    * Use robust URL parsing and matching. A simple hostname match should be the default, but consider allowing more complex patterns if specified (e.g., `*.example.com/path/*`). For simplicity, start with hostname matching.
    * If the active tab's URL matches a distracting site:
        * Record the start time.
        * When the tab is deactivated, navigated away from, or closed, calculate the duration spent and add it to `usageStats` for the current day and that specific site ID.
        * Handle cases where the browser window loses focus (potentially pause timers, though this can be complex; initial version might track based on tab activity).
        * Accurately track time only when the tab is the active tab in the active window.
    * Increment `opens` count in `usageStats` each time a distracting site is newly visited (transition from a non-distracting URL to a distracting one, or a new tab).

* **5.1.2. Limit Enforcement & Blocking (`site_blocker.js`)**
    * On each update to `usageStats` or when a distracting site is navigated to, check if `timeSpentSeconds` for that site ID has exceeded `dailyLimitSeconds` from its entry in `distractingSites`.
    * If the limit is exceeded:
        * Use `browser.tabs.update(tabId, { url: browser.runtime.getURL("ui/timeout/timeout.html") + "?blockedUrl=" + encodeURIComponent(originalUrl) + "&siteId=" + siteId })` to redirect the current tab.
        * Pass the original blocked URL and site ID (or pattern) as query parameters to the timeout page so it can display relevant information.

* **5.1.3. Data Storage Interaction (`storage_manager.js`)**
    * Provide asynchronous functions to:
        * `getDistractingSites()`: Returns array of site objects.
        * `addDistractingSite(siteObject)`: Adds a new site, generates a unique ID.
        * `updateDistractingSite(siteId, updates)`: Updates an existing site.
        * `deleteDistractingSite(siteId)`: Removes a site.
        * `getTimeoutNotes()`: Returns array of note objects.
        * `addTimeoutNote(noteObject)`: Adds a new note, generates a unique ID.
        * `updateTimeoutNote(noteId, updates)`: Updates an existing note.
        * `deleteTimeoutNote(noteId)`: Removes a note.
        * `getUsageStats(dateString)`: Returns usage stats for a given date.
        * `updateUsageStats(dateString, siteId, usageData)`: Updates or creates usage data for a site on a specific date.
        * `getAllSettings()`: Retrieves all settings (sites and notes).
        * `saveAllSettings(settingsObject)`: Saves all settings.
    * All data stored in `browser.storage.local`.
    * Implement data validation before saving.

* **5.1.4. Daily Reset Logic (`daily_reset.js` or integrated into `main.js`)**
    * Use `browser.alarms.create("dailyResetAlarm", { periodInMinutes: 24 * 60 })`. An alarm at a specific time (e.g., midnight) is better: `when: nextMidnightTimestamp`.
    * On alarm, clear `timeSpentSeconds` and `opens` for all sites in `usageStats` for the *new* current day. Old daily stats should be kept for history (unless specified otherwise; current design keeps them under dated keys). The simplest approach is to just ensure that `usageStats` are always keyed by the current date, effectively starting fresh each day for tracking.
    * This ensures time limits are reset daily.

**5.2. Settings UI (`ui/settings/`)**

* **5.2.1. General Layout (`settings.html`, `settings.css`)**
    * Clean, intuitive, and "trendy" design. This means modern aesthetics, good typography, clear visual hierarchy, and ease of use.
    * Responsive if it's an options page.
    * Two main sections: "Distracting Sites" and "Timeout Notes."

* **5.2.2. Managing Distracting Sites (`settings.js`, `site_list_item.js`)**
    * **Display:** List current distracting sites. Each item shows URL pattern and daily time limit (e.g., "example.com - 60 minutes").
    * **Add:**
        * Input field for URL pattern (e.g., "youtube.com"). Basic validation for valid URL format.
        * Input field for daily time limit in minutes (numeric, positive).
        * "Add Site" button.
        * On add, send message to background script to save; UI updates on success.
    * **Edit:**
        * "Edit" button next to each site. Allows modification of the time limit. URL pattern editing might be complex (could change identity); simpler to delete and re-add if URL needs change. For phase 1, only time limit is editable.
        * On save, send message to background script; UI updates.
    * **Delete:**
        * "Delete" button next to each site.
        * Confirmation prompt before deletion.
        * On delete, send message to background script; UI updates.

* **5.2.3. Managing Timeout Notes (`settings.js`, `note_list_item.js`)**
    * **Display:** List current timeout notes. Each item shows the note text.
    * **Add:**
        * Text input field for the note.
        * "Add Note" button.
        * On add, send message to background script; UI updates.
    * **Edit:**
        * "Edit" button next to each note. Allows modification of the text.
        * On save, send message to background script; UI updates.
    * **Delete:**
        * "Delete" button next to each note.
        * Confirmation prompt before deletion.
        * On delete, send message to background script; UI updates.

* **5.2.4. Communication (`settings.js`)**
    * On load, request all settings from the background script.
    * All modifications are sent to the background script for processing and storage.
    * Listen for messages from the background script if settings are updated elsewhere (e.g., by future sync features) to keep the UI consistent.

**5.3. Timeout Page UI (`ui/timeout/`)**

* **5.3.1. Display Logic (`timeout.html`, `timeout.css`, `timeout.js`)**
    * Clean, calm, and non-intrusive design.
    * Parse query parameters (`blockedUrl`, `siteId`) from the URL.
    * Display a clear message, e.g., "Your time limit for `[blockedUrl]` has been reached for today."
    * Request the list of `timeoutNotes` from the background script (or directly from storage if permissions allow and it simplifies).
    * Randomly select one note from the list and display it (e.g., "Instead, why not: Go for a walk?").
    * If no notes are configured, display a default message or hide the notes section.
    * Optionally: Display when the site will be accessible again (e.g., "Available again tomorrow.").

**5.4. Data Storage Schema (`storage_manager.js` manages this structure)**

* **`distractingSites`**: `Array<Object>`
    ```json
    [
      {
        "id": "uuid-string-1",      // Auto-generated unique ID (e.g., using `crypto.randomUUID()`)
        "urlPattern": "example.com", // User-provided URL pattern (hostname based initially)
        "dailyLimitSeconds": 3600,   // Time limit in seconds
        "isEnabled": true            // Boolean to easily toggle a site rule on/off
      }
    ]
    ```
* **`timeoutNotes`**: `Array<Object>`
    ```json
    [
      {
        "id": "uuid-string-note-1", // Auto-generated unique ID
        "text": "Play the guitar"
      }
    ]
    ```
* **`usageStats`**: `Object`
    ```json
    {
      // Key is "YYYY-MM-DD"
      "2025-05-13": {
        // Key is site "id" from distractingSites
        "uuid-string-1": {
          "timeSpentSeconds": 1200,
          "opens": 5
        },
        "uuid-string-2": {
          "timeSpentSeconds": 300,
          "opens": 2
        }
      }
      // Old data for previous dates can be pruned by a separate maintenance task if storage becomes an issue,
      // but for now, it will be retained.
    }
    ```
* **`extensionSettings`**: `Object` (for global extension settings if any in future)
    ```json
    {
        "theme": "default", // Example for future extensibility
        "showDailyResetNotification": false
    }
    ```
    (Initially, this may not be needed).

**6. Component Architecture (UI)**

* Emphasis on small, reusable, single-responsibility components, especially within the settings page.
* Implemented using plain JavaScript functions that create and manage DOM elements, or by defining them as classes if that structure is preferred.
* **Example Components for Settings Page:**
    * `SiteListItem(siteData, onEdit, onDelete)`: Renders a single site entry with controls.
    * `NoteListItem(noteData, onEdit, onDelete)`: Renders a single note entry with controls.
    * `EditableField(initialValue, onSave, inputType)`: A generic component for inline editing.
* This modularity is key for maintainability and the ability to swap or add UI parts as requested.

**7. Data Flow & State Management**

* **Single Source of Truth:** `browser.storage.local` (managed by `storage_manager.js` in the background script) is the ultimate source of truth for all persistent data (distracting sites, notes, historical usage).
* **Background Script State:** Background scripts maintain some in-memory state for current operations (e.g., active timers, recently accessed URLs) but rely on storage for persistence.
* **UI <-> Background Communication:**
    * UI pages (Settings, Timeout) use `browser.runtime.sendMessage()` to send requests/data to the background script.
    * Background script uses `browser.runtime.onMessage.addListener()` to handle these requests.
    * Background script can send responses back via the `sendResponse` callback.
    * For proactive updates from background to UI (e.g., if settings change elsewhere), the background can send messages to specific open UI pages, or UIs can poll/re-fetch on focus. A more robust method is for the background script to message all relevant UI views when data changes.
* **State in UI:** UI components will fetch data on load and manage their local view state. They trigger updates to the background for persistent changes.

**8. UI/UX Design Considerations**

* **Overall Feel:** Clean, modern, intuitive, and "trendy." This translates to:
    * Minimalist aesthetic.
    * Ample whitespace.
    * Clear, legible typography (use system fonts or a well-chosen, bundled web font).
    * Consistent visual language (colors, spacing, iconography).
    * WCAG 2.1 AA accessibility compliance (color contrast, keyboard navigation, ARIA attributes where necessary).
* **Settings Page:**
    * Logical grouping of settings.
    * Clear calls to action (buttons like "Add", "Save", "Delete").
    * Non-destructive actions should be easy; destructive actions (delete) should have confirmations.
    * Provide feedback on operations (e.g., "Site saved," "Note deleted").
    * Responsive design if implemented as a full options page.
* **Timeout Page:**
    * Should be calming, not alarming or frustrating.
    * Clearly state why access is blocked.
    * Motivational notes should be easily readable and encouraging.
* **Icons:** Use clear and recognizable icons for the extension (browser toolbar, settings).

**9. API Design (Internal Extension Communication)**

* Messages between extension components (UI, background) will use a defined structure:
    ```javascript
    // Example message from Settings UI to Background to add a site
    browser.runtime.sendMessage({
      action: "addDistractingSite",
      payload: { urlPattern: "example.com", dailyLimitSeconds: 1800, isEnabled: true }
    }).then(response => {
      if (response.success) { /* UI update */ }
      else { /* handle error */ }
    });

    // In background script:
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "addDistractingSite") {
        storage_manager.addDistractingSite(message.payload)
          .then(newSite => sendResponse({ success: true, data: newSite }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates asynchronous response
      }
      // ... other actions
    });
    ```
* Define clear `action` types and `payload` structures for each interaction.

**10. Error Handling & Logging**

* **Error Handling:**
    * Use `try...catch` blocks for operations that might fail (especially storage interactions, API calls).
    * Provide user-friendly error messages in the UI where appropriate (e.g., "Failed to save settings. Please try again.").
    * Validate all user inputs (URLs, time limits, note text) to prevent errors and potential security issues.
* **Logging:**
    * Use `console.log()`, `console.warn()`, `console.error()` strategically.
    * Differentiate logs for development and production. Consider a global debug flag that can be toggled during development.
    * Avoid excessive logging in production to prevent performance degradation.
    * Log critical errors or unexpected states.

**11. Testing Strategy**

* **Unit Tests (`/tests/unit`):**
    * Target individual modules/functions in isolation.
    * **Modules:** `storage_manager.js`, `time_tracker.js`, `site_blocker.js`, utility functions in `/lib`.
    * Use a testing framework like Jest or Mocha/Chai.
    * Mock WebExtension APIs (`browser` object) using libraries like `webextension-polyfill-ts/dist/browser-polyfill.min.js` (for its types/structure) or custom mocks. Example: `jest.mock('webextension-polyfill')`.
* **Integration Tests (`/tests/integration`):**
    * Test interactions between different modules of the background script (e.g., `time_tracker` updating data that `site_blocker` reads).
    * Test message passing between UI scripts and background scripts.
* **End-to-End (E2E) / Manual Testing:**
    * Create a test plan covering all user stories:
        * Adding/editing/deleting distracting sites.
        * Adding/editing/deleting notes.
        * Verifying time tracking accuracy.
        * Verifying site blocking and redirection to timeout page.
        * Verifying correct display of timeout page content.
        * Verifying daily reset of time limits.
        * Testing edge cases (e.g., invalid inputs, no notes configured).
    * Manual testing in Firefox is essential. Automated E2E tests (e.g., using WebdriverIO or Puppeteer with `web-ext run`) can be considered for future iterations if complexity grows.
* **Data Mocking:** Mock data strictly for tests. No stubbed or fake data in dev/prod environments.

**12. Security Considerations**

* **Input Validation:**
    * Validate URL patterns entered by the user to ensure they are well-formed.
    * Validate time limits (numeric, within reasonable bounds).
    * Sanitize any text input that might be rendered as HTML (though for timeout notes, displaying as plain text is safer and preferred). If HTML rendering is ever used, use appropriate sanitization libraries to prevent XSS.
* **Permissions:** Request only necessary permissions in `manifest.json`. Adhere to the principle of least privilege.
* **Storage:** Data in `browser.storage.local` is sandboxed to the extension. No highly sensitive personal data is stored.
* **Third-party Libraries:** If any are introduced, vet them for security vulnerabilities.

**13. Future Extensibility**

The design aims to support future enhancements with minimal refactoring:

* **Swappable Limit Types:**
    * The `distractingSites` schema can be extended:
        ```json
        {
          "id": "uuid-string-1",
          "urlPattern": "example.com",
          "limitType": "time" | "opens", // New field
          "config": { // Object to hold type-specific limit values
            "dailyTimeLimitSeconds": 3600,  // if limitType is 'time'
            "dailyOpenLimit": 10          // if limitType is 'opens'
          },
          "isEnabled": true
        }
        ```
    * `site_blocker.js` would need a strategy pattern or conditional logic to apply the correct limit type based on `limitType` and values in `config`.
    * `time_tracker.js` would already track `opens`, so data is available.
* **Swappable Timeout Screens:**
    * The redirection target in `site_blocker.js` could become configurable (e.g., stored in `extensionSettings`).
    * Alternatively, `timeout.html` could dynamically load different content modules based on a user setting.
* **New Features:** Adding features like whitelisting specific paths on a distracting domain, "break" periods, or more detailed statistics can be built upon the existing modular structure.
* **Component-Based UI:** The settings UI's component structure allows for easier addition of new settings sections or modification of existing ones.

**14. Build & Deployment**

* **Development:** Use `web-ext run` for easy testing and reloading during development.
* **Build Process:** For distribution, a simple process might involve:
    * Linting and formatting checks.
    * Running tests.
    * Packaging the extension into a `.zip` file (or `.xpi`) for submission to the Firefox Add-ons store (AMO).
    * This can be automated with npm scripts.
* **Source Control:** Use Git. Follow branching strategies (e.g., Gitflow or simpler feature branches).
* **Versioning:** Use semantic versioning (Major.Minor.Patch).

**15. Documentation**

* **In-code Comments:** Write concise, meaningful comments only where necessary to clarify complex logic.
* **`/docs` Directory:**
    * `README.md`: Overview, setup instructions, contribution guidelines.
    * `change_log.md`: Chronological list of significant changes, features, and bug fixes, grouped by date (YYYY-MM-DD).
    * `architecture.md`: (Optional) More detailed explanation of architectural decisions if needed.
    * Documentation for major features or complex modules will be added as new `.md` files within `/docs`.
* Adherence to all documentation rules outlined in the project request is mandatory.

This technical specification provides a comprehensive foundation for the development of the Firefox Distraction Limiter extension. It prioritizes simplicity, modularity, maintainability, and adherence to best practices as per the project rules.