# Site Grouping & Collective Limit Management

## Overview
Users often circumvent individual site limits by switching to alternative platforms that serve the same purpose (e.g., switching from Twitter to Reddit when social media limits are reached). This feature introduces site grouping functionality that allows users to set collective limits across related websites, preventing limit evasion and creating more effective digital boundaries.

## Core Value Proposition
Transform individual site blocking into category-based digital wellness by grouping related distracting sites under shared limits, making it impossible to circumvent restrictions through platform switching while maintaining granular control over different types of digital activities.

## Feature Set

### 🏷️ Smart Site Grouping System
**Problem**: Users bypass individual site limits by switching to alternative platforms (YouTube → TikTok, CNN → BBC, Twitter → Reddit).

**Solution**: Category-based grouping with shared limits
- **Group Creation**: Create named groups in settings (e.g., "Social Media", "News", "Video Streaming")
- **Flexible Group Management**: Add/remove sites from groups with drag-and-drop interface
- **Group Identification**: Each group has unique name and ID for system management
- **Duplicate Prevention**: System checks prevent adding the same website to multiple groups or individual limits
- **Group Hierarchy**: Clear visual indication of which sites belong to which groups

**User Benefits**: Prevents limit circumvention, creates more effective digital boundaries, and provides category-based thinking about digital habits.

### ⚖️ Collective Limit Enforcement
**Problem**: Individual limits become ineffective when users can switch between similar sites within the same category.

**Solution**: Unified time and open count tracking across grouped sites
- **Shared Time Limits**: Group members collectively consume from the same daily time allowance
- **Shared Open Count Limits**: Group members collectively consume from the same daily visit allowance
- **Real-time Deduction**: Any activity on grouped sites decreases the shared group limits
- **Individual Override Prevention**: Sites in groups cannot have individual limits (prevents double-limiting)
- **Seamless Migration**: Sites with existing individual limits can be moved to groups, automatically removing individual restrictions

**User Benefits**: Creates truly effective limits that can't be circumvented, better reflects how users actually consume similar content across platforms.

### 🎯 Streamlined Group Management
**Problem**: Managing grouped sites should be as easy as managing individual sites, with clear visual feedback about group status.

**Solution**: Integrated group management across all interfaces
- **Settings Integration**: Full group CRUD operations in settings page with visual group indicators
- **Popup Integration**: Add current site to existing groups directly from popup without setting individual limits
- **Group Usage Display**: Popup shows collective group usage/limits when visiting grouped sites
- **Visual Group Indicators**: Clear visual distinction between grouped and individual sites
- **Migration Workflow**: Smooth transition process when moving sites between individual and group limits

**User Benefits**: Maintains ease of use while providing powerful grouping capabilities, clear understanding of current limit status.

### 🚫 Unified Timeout Experience
**Problem**: Users should understand they've hit a category limit, not just a specific site limit.

**Solution**: Group-aware timeout messaging
- **Group-Level Messaging**: Timeout page displays group name instead of individual site names
- **Category Context**: Clear messaging about which category of sites is limited
- **Group-Wide Blocking**: All sites in the group become inaccessible when group limit is reached
- **Motivational Messaging**: Timeout messages can be customized per group for more relevant motivation

**User Benefits**: Reinforces category-based thinking, prevents confusion about which sites are blocked and why.

## Implementation Priority

### Phase 1 (Core Grouping)
1. Group creation and management in settings
2. Basic site assignment to groups
3. Shared limit tracking and enforcement

### Phase 2 (Enhanced UX)
1. Popup integration for group management
2. Visual group indicators throughout UI
3. Group-aware timeout pages

### Phase 3 (Advanced Features)
1. Drag-and-drop group management
2. Group usage analytics and insights
3. Smart group suggestions based on usage patterns

## Technical Requirements

### Data Structure
- Groups have unique IDs and user-defined names
- Sites can belong to either a group OR have individual limits (mutually exclusive)
- Group settings include time limits, open count limits, and motivational messages
- Migration system for moving sites between individual and group limits

### User Interface
- Settings page: Group creation, site assignment, limit configuration
- Popup page: Group membership management, collective usage display
- Timeout page: Group-aware messaging and motivation

### Validation & Safety
- Prevent duplicate site assignments across groups and individual limits
- Validate group limits follow same rules as individual limits
- Ensure smooth migration of existing individual limits to groups

## Success Metrics
- **Limit Effectiveness**: Reduced circumvention behavior compared to individual limits
- **User Adoption**: Percentage of users creating and actively using groups
- **Category Awareness**: User feedback on improved understanding of their digital consumption patterns
- **Retention**: Sustained usage of grouped limits over time
- **Migration Success**: Smooth transition of existing individual limits to group structure

## Technical Considerations
- Backward compatibility with existing individual site limits
- Efficient group lookup and limit checking for real-time enforcement
- Clear data migration path for existing users
- Group-aware badge text calculations and display
- Storage optimization for group relationships and shared usage tracking

This feature transforms individual site management into intelligent category-based digital wellness, addressing the fundamental limitation of current per-site approaches while maintaining user control and flexibility.

