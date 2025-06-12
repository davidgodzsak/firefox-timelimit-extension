/**
 * @file site_storage.js
 * @description Manages CRUD operations for distracting sites in browser.storage.local.
 */

/**
 * Retrieves the list of distracting sites from storage.
 *
 * @async
 * @function getDistractingSites
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of distracting site objects.
 *                                    Returns an empty array if no sites are found or an error occurs.
 */
export async function getDistractingSites() {
  try {
    const result = await browser.storage.local.get("distractingSites");
    return result.distractingSites || [];
  } catch (error) {
    console.error("Error getting distracting sites:", error);
    return [];
  }
}

/**
 * Adds a new distracting site to the storage.
 * Validates the site object and generates a unique ID.
 *
 * @async
 * @function addDistractingSite
 * @param {Object} siteObject - The site object to add.
 * @param {string} siteObject.urlPattern - The URL pattern for the site.
 * @param {number} siteObject.dailyLimitSeconds - The daily time limit in seconds.
 * @param {boolean} [siteObject.isEnabled=true] - Whether the site rule is enabled.
 * @returns {Promise<Object|null>} A promise that resolves to the added site object (including its new ID)
 *                                 or null if validation fails or a storage error occurs.
 */
export async function addDistractingSite(siteObject) {
  if (!siteObject || typeof siteObject.urlPattern !== 'string' || siteObject.urlPattern.trim() === '' ||
      typeof siteObject.dailyLimitSeconds !== 'number' || siteObject.dailyLimitSeconds <= 0) {
    console.error("Invalid siteObject provided to addDistractingSite. 'urlPattern' (string) and 'dailyLimitSeconds' (positive number) are required.", siteObject);
    return null;
  }

  const newSite = {
    id: crypto.randomUUID(),
    urlPattern: siteObject.urlPattern.trim(),
    dailyLimitSeconds: siteObject.dailyLimitSeconds,
    isEnabled: typeof siteObject.isEnabled === 'boolean' ? siteObject.isEnabled : true,
  };

  try {
    const sites = await getDistractingSites();
    sites.push(newSite);
    await browser.storage.local.set({ distractingSites: sites });
    return newSite;
  } catch (error) {
    console.error("Error adding distracting site:", error);
    return null;
  }
}

/**
 * Updates an existing distracting site in storage by its ID.
 * Validates the updates before applying them.
 *
 * @async
 * @function updateDistractingSite
 * @param {string} siteId - The ID of the site to update.
 * @param {Object} updates - An object containing the properties to update.
 * @param {string} [updates.urlPattern] - The new URL pattern.
 * @param {number} [updates.dailyLimitSeconds] - The new daily time limit in seconds.
 * @param {boolean} [updates.isEnabled] - The new enabled state.
 * @returns {Promise<Object|null>} A promise that resolves to the updated site object
 *                                 or null if the site is not found, validation fails, or a storage error occurs.
 */
export async function updateDistractingSite(siteId, updates) {
  if (!siteId || typeof siteId !== 'string') {
    console.error("Invalid siteId provided to updateDistractingSite.");
    return null;
  }
  if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    console.error("Invalid updates object provided to updateDistractingSite.", updates);
    return null;
  }

  // Validate updates
  if (updates.hasOwnProperty('urlPattern') && (typeof updates.urlPattern !== 'string' || updates.urlPattern.trim() === '')) {
    console.error("Invalid urlPattern in updates for updateDistractingSite.", updates.urlPattern);
    return null;
  }
  if (updates.hasOwnProperty('dailyLimitSeconds') && (typeof updates.dailyLimitSeconds !== 'number' || updates.dailyLimitSeconds <= 0)) {
    console.error("Invalid dailyLimitSeconds in updates for updateDistractingSite.", updates.dailyLimitSeconds);
    return null;
  }
  if (updates.hasOwnProperty('isEnabled') && typeof updates.isEnabled !== 'boolean') {
    console.error("Invalid isEnabled in updates for updateDistractingSite.", updates.isEnabled);
    return null;
  }

  try {
    const sites = await getDistractingSites();
    const siteIndex = sites.findIndex(site => site.id === siteId);

    if (siteIndex === -1) {
      console.warn(`Site with ID "${siteId}" not found for update.`);
      return null;
    }

    // Create the updated site object by merging current site with validated updates
    const updatedSite = { ...sites[siteIndex], ...updates };
    
    sites[siteIndex] = updatedSite;
    await browser.storage.local.set({ distractingSites: sites });
    return updatedSite;
  } catch (error) {
    console.error(`Error updating distracting site with ID "${siteId}":`, error);
    return null;
  }
}

/**
 * Deletes a distracting site from storage by its ID.
 *
 * @async
 * @function deleteDistractingSite
 * @param {string} siteId - The ID of the site to delete.
 * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful,
 *                             false if the site was not found, siteId was invalid or a storage error occurred.
 */
export async function deleteDistractingSite(siteId) {
  if (!siteId || typeof siteId !== 'string') {
    console.error("Invalid siteId provided to deleteDistractingSite.");
    return false;
  }
  try {
    let sites = await getDistractingSites();
    const initialLength = sites.length;
    sites = sites.filter(site => site.id !== siteId);

    if (sites.length === initialLength) {
      console.warn(`Site with ID "${siteId}" not found for deletion.`);
      return false; // Site not found
    }

    await browser.storage.local.set({ distractingSites: sites });
    return true;
  } catch (error) {
    console.error(`Error deleting distracting site with ID "${siteId}":`, error);
    return false;
  }
} 