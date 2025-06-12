// Function to show a status message
function showStatus(message, isError = false) {
    console.log('Status:', message, isError ? '(error)' : '');
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = '';
    }, 3000);
}

// Function to add a new distracting site
async function addSite() {
    console.log('Add site function called');
    const urlPattern = document.getElementById('urlPattern').value.trim();
    const dailyLimit = parseInt(document.getElementById('dailyLimit').value, 10);

    console.log('Input values:', { urlPattern, dailyLimit });

    if (!urlPattern) {
        showStatus('Please enter a URL pattern', true);
        return;
    }
    if (isNaN(dailyLimit) || dailyLimit <= 0) {
        showStatus('Please enter a valid daily time limit', true);
        return;
    }

    try {
        console.log('Sending message to background script...');
        const response = await browser.runtime.sendMessage({
            action: 'addDistractingSite',
            payload: {
                urlPattern: urlPattern,
                dailyLimitSeconds: dailyLimit
            }
        });
        console.log('Response from background script:', response);

        if (response) {
            showStatus('Site added successfully!');
            document.getElementById('urlPattern').value = '';
            document.getElementById('dailyLimit').value = '3600';
            loadSites(); // Refresh the site list
        } else {
            showStatus('Failed to add site', true);
        }
    } catch (error) {
        console.error('Error in addSite:', error);
        showStatus(`Error: ${error.message}`, true);
    }
}

// Function to delete a distracting site
async function deleteSite(siteId) {
    console.log('Delete site called for ID:', siteId);
    try {
        const success = await browser.runtime.sendMessage({
            action: 'deleteDistractingSite',
            payload: { id: siteId }
        });
        console.log('Delete response:', success);

        if (success) {
            showStatus('Site deleted successfully!');
            loadSites(); // Refresh the site list
        } else {
            showStatus('Failed to delete site', true);
        }
    } catch (error) {
        console.error('Error in deleteSite:', error);
        showStatus(`Error: ${error.message}`, true);
    }
}

// Function to load and display the list of distracting sites
async function loadSites() {
    console.log('Loading sites...');
    try {
        const response = await browser.runtime.sendMessage({
            action: 'getAllSettings'
        });
        console.log('Loaded sites:', response);

        const siteList = document.getElementById('siteList');
        siteList.innerHTML = ''; // Clear current list

        if (response && response.distractingSites) {
            if (response.distractingSites.length === 0) {
                siteList.innerHTML = '<p>No distracting sites added yet.</p>';
                return;
            }

            response.distractingSites.forEach(site => {
                const siteDiv = document.createElement('div');
                siteDiv.style.margin = '10px 0';
                siteDiv.style.padding = '10px';
                siteDiv.style.backgroundColor = '#f9f9f9';
                siteDiv.style.borderRadius = '4px';
                siteDiv.innerHTML = `
                    <strong>${site.urlPattern}</strong>
                    <br>
                    Daily limit: ${site.dailyLimitSeconds} seconds
                    <button class="delete-btn" data-site-id="${site.id}" 
                            style="float: right; background: #d70022;">
                        Delete
                    </button>
                `;
                siteList.appendChild(siteDiv);
            });

            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const siteId = e.target.dataset.siteId;
                    deleteSite(siteId);
                });
            });
        } else {
            siteList.innerHTML = '<p>Error loading sites.</p>';
        }
    } catch (error) {
        console.error('Error in loadSites:', error);
        showStatus(`Error: ${error.message}`, true);
    }
}

// Initialize event listeners when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Settings page loaded');
    
    // Add click handler for the add site button
    const addButton = document.getElementById('addSiteBtn');
    if (addButton) {
        console.log('Add button found, adding click listener');
        addButton.addEventListener('click', addSite);
    } else {
        console.error('Add button not found!');
    }

    // Load initial sites
    loadSites();
}); 