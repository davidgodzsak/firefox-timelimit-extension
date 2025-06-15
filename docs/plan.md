<brainstorming\>
The goal is to create a detailed, step-by-step implementation plan for the Firefox Distraction Limiter extension, suitable for an AI code generation system. The plan must be based on the provided project request, rules, and the technical specification I generated earlier.

My approach will be to break down the development into logical phases, starting with project setup, then moving to core backend (background script) functionalities like storage and time tracking, followed by UI development (timeout page, settings page), and finally testing and documentation.

**Key Considerations for the Plan:**

1.  **Atomicity:** Each step must be small and focused, implementable in a single iteration by the AI.
2.  **File Limits:** Adhere to the "max 20 files, ideally less" rule per step.
3.  **Sequential Logic:** Steps must build upon each other, respecting dependencies.
4.  **Clarity for AI:** Tasks should be unambiguously described.
5.  **User Instructions:** Include necessary manual steps for the user (e.g., installing libraries, providing assets).
6.  **Coverage:** Ensure all aspects of the technical specification are covered.
7.  **Project Rules Adherence:** Simplicity, modularity, small files (under 200 lines) should be implicitly supported by the plan's structure.

**Phased Breakdown Idea:**

  * **Phase 0: Project Setup & Foundation:** Essential configurations, `manifest.json`, directory structure, tooling.
  * **Phase 1: Storage Management (`storage_manager.js`):** This is a core dependency for almost everything else. Implementing its functions first is crucial.
  * **Phase 2: Core Background Logic:**
      * Daily Reset (`daily_reset.js`)
      * Time Tracking (`time_tracker.js`)
      * Site Blocking (`site_blocker.js`)
      * Main Orchestration (`main.js`) and `manifest.json` updates for background scripts.
  * **Phase 3: UI - Timeout Page:** The simpler of the two UI pages.
  * **Phase 4: UI - Settings Page (Options UI):** More complex, with CRUD operations for sites and notes, requiring component-like structures.
  * **Phase 5: Testing:** Dedicated steps for writing unit and integration tests as outlined in the spec.
  * **Phase 6: Refinement, Documentation & Finalization:** UI polish, error handling review, `README`, `change_log.md`.

**Detailed Step Planning (Pre-computation/Pre-analysis):**

  * **`manifest.json` evolution:** It will be touched multiple times: initial setup, adding background scripts, defining options\_ui, web\_accessible\_resources for timeout page, and final review.
  * **Modularity:** The plan will create separate `.js` files for `storage_manager`, `time_tracker`, `site_blocker`, `daily_reset`, and `main` in the `background_scripts` folder, respecting the \<200 lines rule.
  * **UI Components:** For the settings page, I'll break down creating list item renderers (`SiteListItem`, `NoteListItem`) as separate small tasks, even if they are just functions within `settings.js` or small dedicated files in `ui/settings/components/`.
  * **Communication:** Message passing between UI and background scripts will be defined as part of the UI interaction steps. The background `main.js` will set up listeners.
  * **Testing:** Unit tests will follow the implementation of each major module (e.g., `storage_manager.test.js` after `storage_manager.js`). Integration tests will come after key interacting components are built.
  * **"Trendy UI":** The plan will specify "clean, modern, and intuitive" for CSS and layout steps, as "trendy" is subjective. Focus will be on functionality and good design principles.
  * **File Paths:** I'll use the project structure defined in the technical specification.

I will now generate the plan in the requested markdown format.
</brainstorming\>

# Implementation Plan

## Phase 0: Project Setup & Foundation

  - [x] Step 0.1: Initialize Project and Basic Directory Structure

      * **Task**: Create the main project directory (`distracting-sites-limiter-firefox`). Initialize `package.json`. Create the basic subdirectory structure as defined in the technical specification (e.g., `/_locales/en`, `/background_scripts`, `/ui/settings`, `/ui/timeout`, `/ui/common_assets/css`, `/ui/common_assets/images`, `/assets/icons`, `/lib`, `/docs`, `/tests/unit`, `/tests/integration`). Create an empty `_locales/en/messages.json`.
      * **Files**:
          * `distracting-sites-limiter-firefox/package.json`: Basic content after `npm init`.
          * `distracting-sites-limiter-firefox/.gitignore`: Standard Node.js and OS-specific ignores, plus `dist/`, `*.zip`, `*.xpi`.
          * `distracting-sites-limiter-firefox/_locales/en/messages.json`: Empty JSON object `{}`.
          * (Directory creation only for others)
      * **Step Dependencies**: None.
      * **User Instructions**:
        1.  Create the root project folder: `mkdir distracting-sites-limiter-firefox && cd distracting-sites-limiter-firefox`.
        2.  Run `npm init -y` (or `yarn init -y`).
        3.  Create the specified subdirectories.
        4.  Create the empty `messages.json` file.
        5.  Create dummy icon files (`icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`) in `/assets/icons` for now. These can be simple colored squares.

  - [x] Step 0.2: Setup Linting (ESLint) and Formatting (Prettier)

      * **Task**: Install ESLint, Prettier, and a common configuration (e.g., `eslint-config-airbnb-base`, `eslint-plugin-import`, `eslint-plugin-mozilla`). Create `.eslintrc.json` and `.prettierrc.json` configuration files. Add lint and format scripts to `package.json`.
      * **Files**:
          * `package.json`: Add devDependencies for ESLint, Prettier, and plugins; add lint/format scripts.
          * `.eslintrc.json`: ESLint configuration (e.g., extends `airbnb-base`, parser options for ES6+, env for browser and webextensions, rules for mozilla plugin).
          * `.prettierrc.json`: Prettier configuration (e.g., `{"semi": true, "singleQuote": true, "trailingComma": "es5"}`).
      * **Step Dependencies**: Step 0.1.
      * **User Instructions**:
        1.  Run `npm install --save-dev eslint prettier eslint-config-airbnb-base eslint-plugin-import eslint-plugin-mozilla` (or chosen alternatives).
        2.  Create the `.eslintrc.json` and `.prettierrc.json` files with initial configurations.

  - [x] Step 0.3: Create Initial `manifest.json`

      * **Task**: Create the `manifest.json` file with essential properties: `manifest_version` (use 3 if primary target is latest Firefox, else 2), `name`, `version` (e.g., "0.1.0"), `description`, `icons`. Include initial necessary permissions: `storage` and `alarms`.
      * **Files**:
          * `manifest.json`: Initial manifest content.
      * **Step Dependencies**: Step 0.1.
      * **User Instructions**: Ensure icon paths in `manifest.json` correctly point to the dummy icons created in Step 0.1.

## Phase 1: Storage Management (`storage_manager.js`)

  - [x] Step 1.1: Implement `storage_manager.js` - Getters for Settings and Usage

      * **Task**: Create `background_scripts/storage_manager.js`. Implement `async` functions:
          * `getDistractingSites()`: Fetches `distractingSites` from `browser.storage.local`, returns `[]` if not found.
          * `getTimeoutNotes()`: Fetches `timeoutNotes` from `browser.storage.local`, returns `[]` if not found.
          * `getUsageStats(dateString)`: Fetches usage stats for a given date key from `browser.storage.local`, returns `{}` if not found.
          * `getAllSettings()`: Fetches both `distractingSites` and `timeoutNotes`.
      * **Files**:
          * `background_scripts/storage_manager.js`: Implementation of getter functions.
      * **Step Dependencies**: Step 0.3.

  - [x] Step 1.2: Implement `storage_manager.js` - Modifiers for Distracting Sites

      * **Task**: In `background_scripts/storage_manager.js`, implement `async` functions:
          * `addDistractingSite(siteObject)`: Adds site, generates unique ID (e.g., `crypto.randomUUID()`). Validates `siteObject` structure.
          * `updateDistractingSite(siteId, updates)`: Updates site by ID.
          * `deleteDistractingSite(siteId)`: Deletes site by ID.
      * **Files**:
          * `background_scripts/storage_manager.js`: Add implementation for these functions.
      * **Step Dependencies**: Step 1.1.

  - [x] Step 1.3: Implement `storage_manager.js` - Modifiers for Timeout Notes

      * **Task**: In `background_scripts/storage_manager.js`, implement `async` functions:
          * `addTimeoutNote(noteObject)`: Adds note, generates unique ID. Validates `noteObject` structure.
          * `updateTimeoutNote(noteId, updates)`: Updates note by ID.
          * `deleteTimeoutNote(noteId)`: Deletes note by ID.
      * **Files**:
          * `background_scripts/storage_manager.js`: Add implementation for these functions.
      * **Step Dependencies**: Step 1.1.

  - [x] Step 1.4: Implement `storage_manager.js` - Usage Stats Update Function

      * **Task**: In `background_scripts/storage_manager.js`, implement `async` function:
          * `updateUsageStats(dateString, siteId, usageData)`: Updates (or creates) usage data for a specific site on a specific date. `usageData` should include `timeSpentSeconds` and `opens`.
      * **Files**:
          * `background_scripts/storage_manager.js`: Add implementation for this function.
      * **Step Dependencies**: Step 1.1.

  - [x] Step 1.5: Unit Tests for `storage_manager.js`

      * **Task**: Create `tests/unit/background_scripts/storage_manager.test.js`. Write unit tests for all functions in `storage_manager.js`. Use `jest-webextension-mock` (or equivalent) to mock `browser.storage.local` and `crypto.randomUUID`.
      * **Files**:
          * `tests/unit/background_scripts/storage_manager.test.js`: Test cases for all storage functions.
          * `tests/setup.js` (or Jest config in `package.json`): Setup for mocking browser APIs.
          * `package.json`: Add Jest and `jest-webextension-mock` devDependencies and test script.
      * **Step Dependencies**: Steps 1.1, 1.2, 1.3, 1.4.
      * **User Instructions**:
        1.  Run `npm install --save-dev jest jest-webextension-mock` (or Mocha/Chai/Sinon equivalents).
        2.  Configure Jest in `package.json` or `jest.config.js` (e.g., `{"preset": "jest-webextension-mock"}`).

## Phase 2: Core Background Logic

  - [x] Step 2.1: Implement `daily_reset.js`

      * **Task**: Create `background_scripts/daily_reset.js`. Implement `initializeDailyResetAlarm()` which creates a `browser.alarms` named (e.g., "dailySiteUsageReset") to trigger daily around midnight. Add an alarm listener that, when triggered, will prepare to reset usage stats for the *new* current day (actual reset interaction with storage will be minimal, focusing on setting current day's stats to zero if this module directly modifies, or signalling `time_tracker`). For now, it can simply log that the alarm fired. The main logic of reset (clearing `timeSpentSeconds` and `opens`) is primarily handled by `time_tracker.js` starting fresh each day or by `storage_manager.js` when `updateUsageStats` is called for a new day for a site. This module mainly ensures an alarm fires.
      * **Files**:
          * `background_scripts/daily_reset.js`: Alarm setup and listener.
      * **Step Dependencies**: Step 1.4 (conceptually, for `usageStats`).

  - [x] Step 2.2: Implement `time_tracker.js` - Basic Structure and Event Listeners

      * **Task**: Create `background_scripts/time_tracker.js`. This module will manage active tab tracking. Add event listeners for `browser.tabs.onActivated`, `browser.tabs.onUpdated`, and `browser.tabs.onRemoved`. Add `browser.windows.onFocusChanged` to track if the browser is active. Store current active tab ID and its URL.
      * Files:
          * `background_scripts/time_tracker.js`: Initial structure, event listeners, and state variables for active tab/window.
      * **Step Dependencies**: Step 1.1 (to fetch `distractingSites`).

  - [x] Step 2.3: Implement `time_tracker.js` - URL Matching and Distracting Site Detection

      * **Task**: In `time_tracker.js`, implement a function `isDistracting(url, distractingSites)` that checks if the given URL matches any `urlPattern` in the `distractingSites` list (fetched via `storage_manager.getDistractingSites()`). Use hostname matching for simplicity initially. This function will be called when tab URL changes or tab becomes active.
      * **Files**:
          * `background_scripts/time_tracker.js`: Add `isDistracting` and integrate it into event listeners.
          * `lib/utils.js` (Optional): If complex URL parsing is needed, create helper functions here (e.g., `getHostname(url)`).
      * **Step Dependencies**: Step 2.2, Step 1.1.

  - [x] Step 2.4: Implement `time_tracker.js` - Time Accumulation and `opens` Count

      * **Task**: In `time_tracker.js`, manage timers. When an active tab is a distracting site:
          * Start a timer if not already started.
          * Periodically (e.g., every few seconds, or on tab deactivation/URL change), calculate elapsed time and update `usageStats` for the current day and site ID using `storage_manager.updateUsageStats()`.
          * Increment an `opens` count in `usageStats` when a distracting site is newly focused/opened.
          * Pause/stop timer if tab becomes inactive, URL changes to non-distracting, window loses focus, or tab is closed.
      * **Files**:
          * `background_scripts/time_tracker.js`: Implement timer logic and interaction with `storage_manager`.
      * **Step Dependencies**: Step 2.3, Step 1.4.

  - [x] Step 2.5: Unit Tests for `time_tracker.js`

      * **Task**: Create `tests/unit/background_scripts/time_tracker.test.js`. Write unit tests for URL matching, distracting site detection, and time accumulation logic (mocking timers, `storage_manager`, and browser tab/window events).
      * **Files**:
          * `tests/unit/background_scripts/time_tracker.test.js`: Test cases.
      * **Step Dependencies**: Step 2.4.

  - [x] Step 2.6: Implement `site_blocker.js` - Limit Checking

      * **Task**: Create `background_scripts/site_blocker.js`. Implement a function `checkAndBlockSite(tabId, url)` which will be called by `time_tracker.js` (or listen to tab events itself). This function fetches the site's definition from `storage_manager.getDistractingSites()` and its current day's usage from `storage_manager.getUsageStats()`. It checks if `timeSpentSeconds` exceeds `dailyLimitSeconds`.
      * **Files**:
          * `background_scripts/site_blocker.js`: Limit checking logic.
      * **Step Dependencies**: Step 1.1, Step 1.4, Step 2.4 (for integration point).

  - [x] Step 2.7: Implement `site_blocker.js` - Redirection

      * **Task**: In `site_blocker.js`, if the limit is exceeded, use `browser.tabs.update(tabId, { url: browser.runtime.getURL("ui/timeout/timeout.html") + "?blockedUrl=" + encodeURIComponent(url) + "&siteId=" + siteId })` to redirect. The `siteId` corresponds to the ID from `distractingSites`.
      * **Files**:
          * `background_scripts/site_blocker.js`: Add redirection logic.
      * **Step Dependencies**: Step 2.6. (A placeholder `ui/timeout/timeout.html` should be created if not already).

  - [x] Step 2.8: Unit Tests for `site_blocker.js`

      * **Task**: Create `tests/unit/background_scripts/site_blocker.test.js`. Write unit tests for limit checking and redirection. Mock `storage_manager` and `browser.tabs.update`.
      * **Files**:
          * `tests/unit/background_scripts/site_blocker.test.js`: Test cases.
      * **Step Dependencies**: Step 2.7.

  - [x] Step 2.9: Implement `main.js` - Background Script Orchestration

      * **Task**: Create `background_scripts/main.js`.
          * Initialize/call main functions from `daily_reset.js`, `time_tracker.js`.
          * Ensure `site_blocker.js` logic is triggered appropriately (e.g., `time_tracker.js` might call `site_blocker.checkAndBlockSite` after updating usage stats).
          * Set up `browser.runtime.onMessage.addListener` to handle requests from UI pages (e.g., settings, timeout page). Initially, these handlers can just log messages.
      * **Files**:
          * `background_scripts/main.js`: Orchestration and message listeners.
      * **Step Dependencies**: Step 2.1, Step 2.4, Step 2.7.

  - [x] Step 2.10: Update `manifest.json` for Background Scripts & Permissions

      * **Task**: Modify `manifest.json` to:
          * Declare `background_scripts/main.js` as the background script (using `{"service_worker": "background_scripts/main.js"}` for Manifest V3, or `{"scripts": ["background_scripts/main.js"]}` for V2).
          * Ensure permissions: `tabs`, `webNavigation` (for reliable URL detection by `time_tracker`), `activeTab` (if specifically needed and host permissions are avoided).
      * **Files**:
          * `manifest.json`: Update background script declaration and permissions.
      * **Step Dependencies**: Step 2.9.

## Phase 3: UI - Timeout Page

  - [x] Step 3.1: Create Timeout Page HTML Structure (`timeout.html`)

      * **Task**: Create `ui/timeout/timeout.html`. Include placeholders for:
          * A message indicating the time limit has been reached for a specific site.
          * A section to display a motivational note.
          * Link to `timeout.css` and `timeout.js`.
      * **Files**:
          * `ui/timeout/timeout.html`: Basic HTML.
      * **Step Dependencies**: None for HTML structure itself.

  - [x] Step 3.2: Style Timeout Page (`timeout.css`)

      * **Task**: Create `ui/timeout/timeout.css`. Apply styles for a clean, calm, and modern appearance. Center content, use legible fonts, and ensure good contrast. Also, create `ui/common_assets/css/global.css` and `ui/common_assets/css/variables.css` if they don't exist, for shared styles/variables.
      * **Files**:
          * `ui/timeout/timeout.css`: Styles specific to the timeout page.
          * `ui/common_assets/css/global.css`: Basic global styles (e.g., body margin reset, box-sizing).
          * `ui/common_assets/css/variables.css`: CSS custom properties for colors, fonts, etc.
      * **Step Dependencies**: Step 3.1.

  - [x] Step 3.3: Implement Timeout Page JavaScript (`timeout.js`) - Display Logic

      * **Task**: Create `ui/timeout/timeout.js`.
          * On load, parse `blockedUrl` and `siteId` from URL query parameters.
          * Display the `blockedUrl` in the designated message area.
          * Send a message to `background_scripts/main.js` (action: "getTimeoutNotes") to fetch the list of timeout notes.
          * On receiving notes, randomly select one and display it. If no notes, display a default message.
      * **Files**:
          * `ui/timeout/timeout.js`: JavaScript logic.
      * **Step Dependencies**: Step 3.1, Step 1.1 (for `getTimeoutNotes` in background), Step 2.9 (for background message listener).

  - [x] Step 3.4: Add Timeout Page to `manifest.json` as Web Accessible Resource

      * **Task**: Modify `manifest.json` to include `ui/timeout/timeout.html` in `web_accessible_resources` so it can be loaded by `browser.tabs.update`.
      * **Files**:
          * `manifest.json`: Add/update `web_accessible_resources`.
      * **Step Dependencies**: Step 3.1.

## Phase 4: UI - Settings Page (Options UI)

  - [x] Step 4.1: Create Settings Page HTML Structure (`settings.html`) & Manifest Entry

      * **Task**: Create `ui/settings/settings.html`.
          * Structure for two main sections: "Manage Distracting Sites" and "Manage Timeout Notes".
          * Include forms (input fields, buttons) for adding new sites/notes.
          * Include `div` containers where lists of sites/notes will be rendered.
          * Link to `settings.css` and `settings.js`.
          * Modify `manifest.json` to declare `ui/settings/settings.html` as the `options_ui` page.
      * **Files**:
          * `ui/settings/settings.html`: HTML structure.
          * `manifest.json`: Add `options_ui` field.
      * **Step Dependencies**: None for HTML structure itself.

  - [x] Step 4.2: Style Settings Page (`settings.css`)

      * **Task**: Create `ui/settings/settings.css`. Apply styles for a clean, intuitive, and modern layout. Style forms, lists, list items, buttons. Ensure it's responsive if it's a full page.
      * **Files**:
          * `ui/settings/settings.css`: Styles for the settings page.
          * (Uses `ui/common_assets/css/global.css` and `variables.css` from Step 3.2).
      * **Step Dependencies**: Step 4.1.

  - [x] Step 4.3: Implement `settings.js` - Load and Display Initial Data

      * **Task**: Create `ui/settings/settings.js`.
          * On DOMContentLoaded, send a message to `background_scripts/main.js` (action: "getAllSettings") to fetch `distractingSites` and `timeoutNotes`.
          * Implement placeholder functions `renderDistractingSites(sites)` and `renderTimeoutNotes(notes)` that will populate the respective list containers in `settings.html`.
      * **Files**:
          * `ui/settings/settings.js`: Initial data loading and placeholder rendering.
      * **Step Dependencies**: Step 4.1, Step 1.1 (for `getAllSettings` in background), Step 2.9 (background message listener).

  - [x] Step 4.4: Implement `SiteListItem` Component and Rendering for Distracting Sites

      * **Task**: In `ui/settings/settings.js` (or a new `ui/settings/components/site_list_item.js` if preferred for modularity):
          * Create a function `createSiteListItem(siteObject)` that generates DOM elements for a single site (displaying URL pattern, daily limit, "Edit" and "Delete" buttons).
          * Update `renderDistractingSites(sites)` in `settings.js` to use this function to build and display the list.
      * **Files**:
          * `ui/settings/settings.js`: Update rendering logic.
          * `ui/settings/components/site_list_item.js` (Optional, if making a separate file): Component logic.
      * **Step Dependencies**: Step 4.3.

  - [x] Step 4.5: Implement Add Distracting Site Functionality

      * **Task**: In `ui/settings/settings.js`:
          * Add event listener to the "Add Site" form.
          * On submit, get URL and time limit from inputs. Validate inputs (URL format, time is positive number).
          * Send message to background (action: "addDistractingSite", payload: site data).
          * On successful response from background, refresh the displayed list of sites (or optimistically add to UI).
      * **Files**:
          * `ui/settings/settings.js`: Add site form handling and communication.
      * **Step Dependencies**: Step 4.4, Step 1.2 (background `addDistractingSite`).

  - [x] Step 4.6: Implement Edit/Delete Distracting Site Functionality

      * **Task**: In `ui/settings/settings.js` (using event delegation on the sites list) or within `site_list_item.js` logic:
          * Handle "Delete" button clicks: Confirm deletion, send message to background (action: "deleteDistractingSite", payload: site ID). Refresh list on success.
          * Handle "Edit" button clicks (for time limit): Show an inline edit field or modal. On save, send message to background (action: "updateDistractingSite", payload: site ID and updated data). Refresh list/item on success.
      * **Files**:
          * `ui/settings/settings.js`: Event handling for edit/delete.
          * `ui/settings/components/site_list_item.js` (If used): May contain button event wiring.
      * **Step Dependencies**: Step 4.5, Step 1.2 (background update/delete).

  - [x] Step 4.7: Implement `NoteListItem` Component and Rendering for Timeout Notes

      * **Task**: Similar to Step 4.4, in `ui/settings/settings.js` (or `ui/settings/components/note_list_item.js`):
          * Create `createNoteListItem(noteObject)` function for a single note (displaying text, "Edit" and "Delete" buttons).
          * Update `renderTimeoutNotes(notes)` in `settings.js` to use this.
      * **Files**:
          * `ui/settings/settings.js`: Update rendering logic.
          * `ui/settings/components/note_list_item.js` (Optional): Component logic.
      * **Step Dependencies**: Step 4.3.

  - [x] Step 4.8: Implement Add Timeout Note Functionality

      * **Task**: In `ui/settings/settings.js`:
          * Add event listener to "Add Note" form.
          * On submit, get note text. Validate input (not empty).
          * Send message to background (action: "addTimeoutNote", payload: note data).
          * Refresh list on success.
      * **Files**:
          * `ui/settings/settings.js`: Add note form handling.
      * **Step Dependencies**: Step 4.7, Step 1.3 (background `addTimeoutNote`).

  - [x] Step 4.9: Implement Edit/Delete Timeout Note Functionality

      * **Task**: Similar to Step 4.6, for notes:
          * Handle "Delete" button clicks: Confirm, send message (action: "deleteTimeoutNote"). Refresh.
          * Handle "Edit" button clicks: Show inline edit. On save, send message (action: "updateTimeoutNote"). Refresh.
      * **Files**:
          * `ui/settings/settings.js`: Event handling.
          * `ui/settings/components/note_list_item.js` (If used): Button event wiring.
      * **Step Dependencies**: Step 4.8, Step 1.3 (background update/delete).

## Phase 5: Testing & Refinement

  - [ ] Step 5.1: Integration Testing - Settings UI with Background

      * **Task**: Create `tests/integration/settings_background_interaction.test.js`. Write tests to verify that actions in the Settings UI (add/edit/delete sites and notes) correctly communicate with the background script and result in data being updated in mock storage. This may involve using tools that can interact with WebExtension popups/options pages or focusing on message passing.
      * **Files**:
          * `tests/integration/settings_background_interaction.test.js`: Test cases.
      * **Step Dependencies**: All of Phase 1, Phase 2, Phase 4.

  - [x] Step 5.2: UI/UX Review and Polish for Settings & Timeout Pages

      * **Task**: Manually review both the Settings and Timeout pages in the browser. Ensure they are visually appealing ("clean, modern, intuitive"), easy to use, and functional. Refine CSS and layout as needed. Check for responsiveness of the Settings page.
      * **Files**:
          * `ui/settings/settings.css`, `ui/settings/settings.html`
          * `ui/timeout/timeout.css`, `ui/timeout/timeout.html`
          * `ui/common_assets/css/*`
      * **Step Dependencies**: Phase 3, Phase 4.

  - [ ] Step 5.3: Comprehensive Error Handling and Input Validation Review

      * **Task**: Systematically review all JavaScript files (`storage_manager.js`, background logic modules, UI scripts). Ensure `try...catch` blocks are used for fallible operations (especially `browser` API calls and storage). Verify all user inputs are validated on the client-side (Settings UI) and, if necessary, again in the background script before storage. Ensure meaningful error messages or feedback.
      * **Files**: All relevant `.js` files across the project.
      * **Step Dependencies**: All previous coding steps.

## Phase 6: Documentation & Finalization

  - [ ] Step 6.1: Create `README.md` and `change_log.md`

      * **Task**:
          * Create `docs/README.md`: Include project description, features, how to install (load unpacked extension in Firefox), how to build (if applicable), and basic usage.
          * Create `docs/change_log.md`: Initialize with v0.1.0 (or current version) and list key features implemented.
      * **Files**:
          * `docs/README.md`
          * `docs/change_log.md`
      * **Step Dependencies**: All features implemented.

  - [ ] Step 6.2: Add In-code Comments and Review File Sizes

      * **Task**: Review all JavaScript files. Add concise comments for complex logic or non-obvious sections. Ensure all files adhere to the \<200 lines of code rule; refactor if any file has grown too large.
      * **Files**: All `.js` files.
      * **Step Dependencies**: All coding steps.

  - [ ] Step 6.3: Final `manifest.json` Review

      * **Task**: Perform a final review of `manifest.json`. Check for:
          * Correct `manifest_version`, `name`, `version`, `description`.
          * All necessary `permissions`.
          * Correct paths for `icons`, `background` scripts, `options_ui`, `web_accessible_resources`.
          * Consider `content_security_policy` if Manifest V3 (default is quite strict).
      * **Files**:
          * `manifest.json`
      * **Step Dependencies**: All steps that modify `manifest.json`.

  - [ ] Step 6.4: Prepare Build/Packaging Scripts

      * **Task**: Add scripts to `package.json` for:
          * `lint`: Runs ESLint.
          * `format`: Runs Prettier.
          * `test`: Runs Jest (or other test runner).
          * `build`: Creates a distributable `.zip` file of the extension (e.g., using `web-ext build` or a custom script).
      * **Files**:
          * `package.json`
      * **Step Dependencies**: Step 0.2, Step 1.5.
      * **User Instructions**: May need to install `web-ext` globally or as a dev dependency: `npm install --save-dev web-ext`.

# Summary of Approach

The implementation plan follows a phased approach, starting with foundational project setup and moving through core backend logic (storage, time tracking, blocking), UI development (timeout and settings pages), and finally, testing and documentation.

**Key Considerations for Implementation:**

1.  **Modularity:** Each JavaScript file and function should aim for a single responsibility, adhering to the specified file size limits to maintain clarity and ease of modification.
2.  **Dependencies:** Steps are ordered to ensure that foundational modules (like `storage_manager.js`) are built before dependent modules.
3.  **Asynchronous Operations:** Extensive use of `async/await` with `browser` API calls is expected for cleaner code.
4.  **Communication:** Message passing between UI scripts and background scripts is a critical part of the architecture. Ensure `action` types and `payloads` are consistent.
5.  **Error Handling:** Robust error handling and input validation must be implemented at each relevant step, not just as an afterthought.
6.  **Testing:** Unit tests should be written alongside module development. Integration tests will verify interactions between components.
7.  **UI/UX:** While "trendy" is subjective, the AI should aim for clean, modern, intuitive, and accessible UIs. Simplicity in design is preferred.
8.  **Iterative Development:** The AI will implement each step sequentially. Manual verification by a human developer after key phases or a set of steps is recommended to ensure the project is on track.