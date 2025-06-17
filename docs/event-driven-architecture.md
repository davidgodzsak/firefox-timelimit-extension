The Manifest V3 Strategy: Events, Alarms, and Storage

Your architecture needs to shift its reliance from a central, always-on orchestrator to three core browser APIs: Events, Alarms, and Storage.
1. Waking Up on Navigation and Tab Switches

You can reliably wake up your service worker whenever the user navigates. You don't need a persistent script for this; the browser itself will trigger your code.

Register listeners for these key events in your service worker's global scope:

    chrome.tabs.onUpdated: Fires when a tab is updated (e.g., the URL changes). Use a filter for status: 'complete' to act only when the page has finished loading.
    chrome.tabs.onActivated: Fires when the active tab in a window changes. This is crucial for knowing when a user switches to or away from a distracting site.
    chrome.windows.onFocusChanged: Fires when the user switches to a different window or application. This allows you to pause your timer when the browser is not in focus.

When any of these events fire, your service worker will wake up, and you can run your "Distraction Detector" logic.
2. Solving the Continuous Time Tracking Problem

This is the most significant change. Since the service worker can't stay active to count seconds, you'll use a combination of storage and alarms to track time in chunks.

Here is the new workflow:

    Start Tracking: When a navigation event (e.g., tabs.onUpdated) reveals the user is on a distracting site, you don't start an internal setInterval. Instead, you do two things:
        Store the start time and the current tab ID in chrome.storage.session. Session storage is perfect for this because it's automatically cleared if the browser closes, preventing ghost timers.
        Create a repeating alarm using chrome.alarms.create(). A one-minute interval is standard and respects system resources.
    JavaScript

    // In your service worker (background.js)

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && isDistracting(tab.url)) {
        // Start tracking
        chrome.storage.session.set({ tracking_startTime: Date.now(), tracking_tabId: tabId });
        // Set an alarm to fire every minute to update the time
        chrome.alarms.create('usageTimer', { periodInMinutes: 1 });
      }
    });

    Update Usage: Your service worker will now wake up every minute when the usageTimer alarm fires.
        In the chrome.alarms.onAlarm listener, check if you are still on the distracting site.
        If yes, calculate the elapsed minute, add it to the total usage for that site in chrome.storage.local, and let the alarm continue.
        If the user has navigated away, calculate the final time fragment, add it to the total, and crucially, clear the alarm using chrome.alarms.clear('usageTimer') to stop it from firing unnecessarily.

    Stop Tracking: When the user navigates away from the distracting site (detected by tabs.onUpdated or tabs.onActivated), calculate the final elapsed time since the last alarm, add it to the total usage, and clear the alarm.

This "chunking" method ensures that time is recorded accurately without requiring your script to be constantly active.
3. Immediate Blocking

For blocking, you don't need to wait for a timer. You can use the chrome.webNavigation.onBeforeNavigate event. This event fires before any content is loaded.

    When this event fires, your service worker wakes up.
    Check if the URL is on your distracting sites list.
    If it is, retrieve the user's current usage from chrome.storage.local.
    If usage >= limit, you can immediately redirect the tab to your timeout page. This is far more efficient and provides a better user experience than waiting for the page to load and then blocking it.

Revised Architecture Flow

Here is how your modules would work in an MV3-compliant way:

    Service Worker (background.js): This is no longer an orchestrator but the central event router. It contains the listeners (onUpdated, onActivated, onAlarm, onBeforeNavigate) that wake it up. These listeners then call the appropriate logic.
    Storage (chrome.storage): This becomes the "brain" or the single source of truth. It holds all settings, distraction lists, motivational notes, and most importantly, the current usage stats for all sites.
    Tab Activity Monitor: This isn't a module anymore. It's simply the set of chrome.tabs and chrome.windows event listeners in your service worker.
    Usage Recorder: This logic now lives inside your chrome.alarms.onAlarm listener and the handlers for navigating away from a site. It reads the startTime from session storage, calculates the delta, and updates the total in local storage.
    Site Blocker: This logic lives inside the chrome.webNavigation.onBeforeNavigate listener. It's a simple, fast check: isDistracting(url) and isTimeUp(url)? If yes, redirect.
    Daily Reset Alarm: This is a perfect and simple use of chrome.alarms. You create a single daily alarm that, when it fires, iterates through your usage stats in chrome.storage.local and resets them to zero.
    Badge Manager: You can update the badge after any event that changes usage—primarily within the onAlarm listener or after a navigation event.

By embracing this event-driven model, your extension will be efficient, compliant with Manifest V3, and just as powerful as your original design.