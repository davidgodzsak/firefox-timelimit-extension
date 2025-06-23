# Grouping sites and limiting groups
Use case: A person is addicted to reading news or social media, if the limit runs out on one website, then htey can just switch to an alternative. Solution: it would be nice to allow users to group websites and add a limit on the group itself not the specific websites.

Requirements:
- On the settings website be able to create groups and add websites to this group, set time and open limit to the group itself not individual sites
- A group should have a name and an id
- Be able to remove websites from groups
- When adding an website on the settings page, we should check if the website is already added or not, let's not add it twice. This should be true regardless whether it's added as part of a group or not.
- If a website is part of a group it should not be able to have individual limits
- If a website that is inside a group is open it should decrease the whole groups remaining time limit
- If a website that is inside a group is opened it should decrease the whole groups remaining open limit
- On the pop up page be able to add a new website to a group. In this case the user should not define a time or an open limit as that
- If a website is added to a group the pop up website should show the usage of the whole group.
- If a website already has time and open limits it should still be possible on the popup page to be added to a group, but then it should be removed from individual limits, and it should work as if it was part of the group
- The timeout page should just show the name of the group, no need to show all websites that belong to the group

