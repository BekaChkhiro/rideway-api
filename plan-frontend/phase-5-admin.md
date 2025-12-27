# Phase 5: Admin Dashboard

## Overview

This phase creates the admin dashboard for platform management. The admin panel allows moderators and administrators to manage users, moderate content, handle reports, view analytics, and configure platform settings.

## Goals

- Build admin dashboard with analytics overview
- Create user management system
- Implement content moderation tools
- Build reports handling system
- Add platform configuration options
- Create role-based access control

---

## Tasks

### 5.1 Admin Layout & Dashboard

- [ ] Create admin layout with sidebar
- [ ] Build dashboard overview page
- [ ] Create stats cards with charts
- [ ] Implement recent activity feed
- [ ] Add quick actions panel
- [ ] Create admin navigation

### 5.2 User Management

- [ ] Create users list with search/filter
- [ ] Build user details page
- [ ] Implement user actions (ban, warn, verify)
- [ ] Add user activity log
- [ ] Create bulk actions
- [ ] Implement user roles management

### 5.3 Content Moderation

- [ ] Create posts moderation queue
- [ ] Build listings moderation
- [ ] Implement forum moderation
- [ ] Add content actions (remove, hide, warn)
- [ ] Create moderation logs
- [ ] Build automated moderation rules

### 5.4 Reports System

- [ ] Create reports queue
- [ ] Implement report details view
- [ ] Add report resolution actions
- [ ] Build reporter/reported history
- [ ] Create report analytics

### 5.5 Analytics & Metrics

- [ ] Create analytics dashboard
- [ ] Implement user growth charts
- [ ] Add content metrics
- [ ] Build engagement analytics
- [ ] Create export functionality

### 5.6 Settings & Configuration

- [ ] Create platform settings page
- [ ] Implement feature flags
- [ ] Add content policies management
- [ ] Create announcement system
- [ ] Build maintenance mode toggle

---

## Technical Details

### Page Structure

```
src/app/(admin)/
└── admin/
    ├── layout.tsx                  # Admin layout with sidebar
    ├── page.tsx                    # Dashboard (redirect)
    ├── dashboard/
    │   └── page.tsx                # Overview dashboard
    ├── users/
    │   ├── page.tsx                # Users list
    │   └── [id]/
    │       └── page.tsx            # User details
    ├── content/
    │   ├── page.tsx                # Content overview
    │   ├── posts/
    │   │   └── page.tsx            # Posts moderation
    │   ├── listings/
    │   │   └── page.tsx            # Listings moderation
    │   └── forum/
    │       └── page.tsx            # Forum moderation
    ├── reports/
    │   ├── page.tsx                # Reports queue
    │   └── [id]/
    │       └── page.tsx            # Report details
    ├── analytics/
    │   └── page.tsx                # Analytics dashboard
    └── settings/
        ├── page.tsx                # General settings
        ├── features/
        │   └── page.tsx            # Feature flags
        └── announcements/
            └── page.tsx            # Announcements
```

### Component Structure

```
src/components/admin/
├── layout/
│   ├── admin-sidebar.tsx           # Admin navigation
│   ├── admin-header.tsx            # Top bar
│   └── admin-breadcrumbs.tsx       # Breadcrumbs
├── dashboard/
│   ├── stats-cards.tsx             # Stat cards grid
│   ├── stat-card.tsx               # Individual stat card
│   ├── activity-feed.tsx           # Recent activity
│   ├── quick-actions.tsx           # Quick action buttons
│   └── charts/
│       ├── users-chart.tsx         # User growth chart
│       ├── content-chart.tsx       # Content creation chart
│       └── engagement-chart.tsx    # Engagement metrics
├── users/
│   ├── users-table.tsx             # Users data table
│   ├── user-details.tsx            # User info panel
│   ├── user-actions.tsx            # Action buttons
│   ├── user-activity.tsx           # Activity log
│   └── user-filters.tsx            # Filter sidebar
├── content/
│   ├── content-table.tsx           # Generic content table
│   ├── content-preview.tsx         # Content preview modal
│   ├── moderation-actions.tsx      # Mod action buttons
│   └── moderation-log.tsx          # Action history
├── reports/
│   ├── reports-table.tsx           # Reports list
│   ├── report-details.tsx          # Report info
│   ├── report-actions.tsx          # Resolution actions
│   └── reporter-history.tsx        # User report history
├── analytics/
│   ├── date-range-picker.tsx       # Date range selector
│   ├── metric-card.tsx             # Metric display
│   └── charts/
│       └── ...
└── settings/
    ├── settings-form.tsx           # Settings form
    ├── feature-toggle.tsx          # Feature flag toggle
    └── announcement-form.tsx       # Create announcement
```

### Types

```typescript
// types/admin.ts
export interface AdminStats {
  users: {
    total: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    activeToday: number;
  };
  content: {
    postsTotal: number;
    postsToday: number;
    listingsTotal: number;
    listingsActive: number;
    threadsTotal: number;
  };
  moderation: {
    pendingReports: number;
    pendingListings: number;
    bannedUsers: number;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  phone?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  role: 'user' | 'moderator' | 'admin';
  lastLoginAt?: string;
  createdAt: string;
  profile: {
    username: string;
    fullName: string;
    avatarUrl?: string;
    bio?: string;
  };
  stats: {
    postsCount: number;
    listingsCount: number;
    followersCount: number;
    reportsReceived: number;
    warningsCount: number;
  };
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporter: {
    username: string;
    avatarUrl?: string;
  };
  reportedId?: string;
  reported?: {
    username: string;
    avatarUrl?: string;
  };
  entityType: 'user' | 'post' | 'comment' | 'listing' | 'thread';
  entityId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  resolution?: string;
  resolvedById?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface ModerationAction {
  id: string;
  adminId: string;
  admin: {
    username: string;
    avatarUrl?: string;
  };
  action: 'warn' | 'remove' | 'hide' | 'ban' | 'unban' | 'verify';
  entityType: string;
  entityId: string;
  reason?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'maintenance';
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
}
```

### API Hooks

```typescript
// lib/api/hooks/use-admin.ts
// Dashboard
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<ApiResponse<AdminStats>>('/admin/stats'),
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['admin', 'activity'],
    queryFn: () => api.get<ApiResponse<UserActivity[]>>('/admin/activity'),
  });
}

// Users
export function useAdminUsers(filters: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
} = {}) {
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: () =>
      api.get<ApiResponse<AdminUser[]>>('/admin/users', {
        ...filters,
        page: String(filters.page || 1),
        limit: '20',
      }),
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => api.get<ApiResponse<AdminUser>>(`/admin/users/${id}`),
    enabled: !!id,
  });
}

export function useUserActivity(userId: string) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'activity'],
    queryFn: () =>
      api.get<ApiResponse<UserActivity[]>>(`/admin/users/${userId}/activity`),
    enabled: !!userId,
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      api.post<ApiResponse<void>>(`/admin/users/${userId}/ban`, { reason }),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      api.post<ApiResponse<void>>(`/admin/users/${userId}/unban`),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

export function useWarnUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      api.post<ApiResponse<void>>(`/admin/users/${userId}/warn`, { reason }),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

export function useVerifyUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      api.post<ApiResponse<void>>(`/admin/users/${userId}/verify`),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

// Reports
export function useReports(filters: { status?: string; type?: string } = {}) {
  return useQuery({
    queryKey: ['admin', 'reports', filters],
    queryFn: () => api.get<ApiResponse<Report[]>>('/admin/reports', filters),
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ['admin', 'reports', id],
    queryFn: () => api.get<ApiResponse<Report>>(`/admin/reports/${id}`),
    enabled: !!id,
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      resolution,
      action,
    }: {
      reportId: string;
      resolution: string;
      action?: string;
    }) =>
      api.post<ApiResponse<void>>(`/admin/reports/${reportId}/resolve`, {
        resolution,
        action,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useDismissReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportId: string) =>
      api.post<ApiResponse<void>>(`/admin/reports/${reportId}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
  });
}

// Content Moderation
export function usePendingContent(type: 'posts' | 'listings' | 'threads') {
  return useQuery({
    queryKey: ['admin', 'moderation', type],
    queryFn: () => api.get<ApiResponse<unknown[]>>(`/admin/moderation/${type}`),
  });
}

export function useRemoveContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      type,
      id,
      reason,
    }: {
      type: string;
      id: string;
      reason: string;
    }) =>
      api.post<ApiResponse<void>>(`/admin/moderation/${type}/${id}/remove`, {
        reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'moderation'] });
    },
  });
}

// Settings
export function useFeatureFlags() {
  return useQuery({
    queryKey: ['admin', 'features'],
    queryFn: () => api.get<ApiResponse<FeatureFlag[]>>('/admin/features'),
  });
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api.patch<ApiResponse<void>>(`/admin/features/${key}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'features'] });
    },
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => api.get<ApiResponse<Announcement[]>>('/admin/announcements'),
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Announcement>) =>
      api.post<ApiResponse<Announcement>>('/admin/announcements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
}
```

---

## Claude Code Prompts

### Prompt 1: Create Admin Layout

```
Create the admin layout and dashboard:

1. Create src/app/(admin)/admin/layout.tsx:
   - Check admin role (redirect if not admin)
   - Sidebar navigation
   - Top header with user info
   - Main content area
   - Responsive design (sidebar collapse on mobile)

2. Create src/components/admin/layout/admin-sidebar.tsx:
   - Logo at top
   - Navigation items:
     - Dashboard (LayoutDashboard icon)
     - Users (Users icon)
     - Content (FileText icon)
     - Reports (Flag icon)
     - Analytics (BarChart icon)
     - Settings (Settings icon)
   - Active state highlighting
   - Collapse button
   - Sub-items for Content

3. Create src/components/admin/layout/admin-header.tsx:
   - Breadcrumbs
   - Search (global admin search)
   - Notifications
   - Admin user dropdown
   - Link to main site

4. Create src/app/(admin)/admin/dashboard/page.tsx:
   - Stats cards row (users, posts, reports, etc.)
   - Charts section (user growth, content)
   - Recent activity feed
   - Quick actions

5. Create src/components/admin/dashboard/stats-cards.tsx:
   - Grid of stat cards
   - Each card: title, value, change percentage, icon
   - Loading skeleton state

6. Create src/components/admin/dashboard/stat-card.tsx:
   - Icon with background color
   - Title (e.g., "Total Users")
   - Value (e.g., "12,345")
   - Change (e.g., "+5.2% from last week")
   - Trend arrow (up/down)

7. Create src/components/admin/dashboard/activity-feed.tsx:
   - Recent admin actions
   - User registrations
   - Reports submitted
   - Content flagged
   - Timestamp and actor

8. Add quick actions:
   - View pending reports
   - Review flagged content
   - Send announcement
```

### Prompt 2: Create User Management

```
Create user management functionality:

1. Create src/app/(admin)/admin/users/page.tsx:
   - Users data table
   - Search by email/username
   - Filter by role, status
   - Pagination
   - Bulk actions

2. Create src/components/admin/users/users-table.tsx:
   Using shadcn/ui data table:
   - Columns: Avatar, Username, Email, Role, Status, Joined, Actions
   - Sortable columns
   - Row selection for bulk actions
   - Click row to view details

3. Create src/components/admin/users/user-filters.tsx:
   - Search input
   - Role filter (user, moderator, admin)
   - Status filter (active, banned, unverified)
   - Date range filter
   - Clear filters

4. Create src/app/(admin)/admin/users/[id]/page.tsx:
   - User info section
   - Activity log
   - Content summary
   - Reports history
   - Action buttons

5. Create src/components/admin/users/user-details.tsx:
   - Avatar and basic info
   - Email (with verification status)
   - Phone (with verification status)
   - Registration date
   - Last login
   - Role badge
   - Ban status

6. Create src/components/admin/users/user-actions.tsx:
   - Edit role dropdown
   - Verify email button
   - Send warning button
   - Ban user button (with reason modal)
   - Unban user button
   - Delete user button (with confirmation)

7. Create src/components/admin/users/user-activity.tsx:
   - List of recent actions
   - Posts created/deleted
   - Comments made
   - Logins
   - Warnings received
   - Pagination

8. Create ban user modal:
   - Reason selection (spam, abuse, etc.)
   - Custom reason text
   - Ban duration (optional)
   - Confirm button

9. Create bulk actions:
   - Ban selected
   - Verify selected
   - Export selected
```

### Prompt 3: Create Content Moderation

```
Create content moderation tools:

1. Create src/app/(admin)/admin/content/page.tsx:
   - Overview of content stats
   - Quick links to moderation queues
   - Recent moderation actions

2. Create src/app/(admin)/admin/content/posts/page.tsx:
   - Posts requiring review
   - Filter by status (flagged, reported, hidden)
   - Sort by reports count, date
   - Bulk moderation actions

3. Create src/app/(admin)/admin/content/listings/page.tsx:
   - Listings requiring review
   - Pending listings (if approval required)
   - Flagged listings
   - Expired listings cleanup

4. Create src/app/(admin)/admin/content/forum/page.tsx:
   - Threads requiring moderation
   - Replies to review
   - Pin/unpin threads
   - Lock/unlock threads

5. Create src/components/admin/content/content-table.tsx:
   - Generic table for any content type
   - Preview column with truncated text
   - Author column
   - Reports count
   - Status badge
   - Actions dropdown

6. Create src/components/admin/content/content-preview.tsx:
   - Modal to preview full content
   - Show images if applicable
   - Author info
   - Original link
   - Report details if flagged

7. Create src/components/admin/content/moderation-actions.tsx:
   - Approve button
   - Hide button (visible to author only)
   - Remove button (with reason)
   - Warn author button
   - Edit content button (for minor fixes)

8. Create src/components/admin/content/moderation-log.tsx:
   - History of actions on content
   - Who took action
   - What action
   - When
   - Reason

9. Action confirmation modals:
   - Remove content modal (requires reason)
   - Warn user modal (message to user)
   - Bulk action confirmation
```

### Prompt 4: Create Reports System

```
Create the reports handling system:

1. Create src/app/(admin)/admin/reports/page.tsx:
   - Reports queue table
   - Filter by status (pending, reviewing, resolved)
   - Filter by type (user, post, comment, listing)
   - Sort by date, priority
   - Assign to moderator

2. Create src/components/admin/reports/reports-table.tsx:
   - Type icon
   - Reported entity preview
   - Reporter info
   - Reason
   - Status badge
   - Created date
   - Actions

3. Create src/app/(admin)/admin/reports/[id]/page.tsx:
   - Full report details
   - Reported content preview
   - Reporter history
   - Reported user history
   - Resolution form
   - Related reports

4. Create src/components/admin/reports/report-details.tsx:
   - Report info card
   - Reason and description
   - Reporter info with link
   - Timestamp

5. Create src/components/admin/reports/reported-content.tsx:
   - Preview of reported item
   - Full content view
   - Link to original
   - Author info

6. Create src/components/admin/reports/report-actions.tsx:
   Actions based on entity type:

   For user reports:
   - Warn user
   - Ban user
   - Dismiss report

   For content reports:
   - Remove content
   - Hide content
   - Warn author
   - Dismiss report

   Resolution notes:
   - Text area for notes
   - Resolution type select

7. Create src/components/admin/reports/reporter-history.tsx:
   - Reports made by this user
   - Help identify false reporters
   - Report accuracy stats

8. Create src/components/admin/reports/reported-history.tsx:
   - Previous reports against this user
   - Previous warnings
   - Pattern detection

9. Create priority indicators:
   - High: multiple reports, verified reporter
   - Medium: single report, new account
   - Low: possible false positive
```

### Prompt 5: Create Analytics Dashboard

```
Create the analytics dashboard:

1. Install chart library:
   - recharts (recommended)
   - OR chart.js with react-chartjs-2

2. Create src/app/(admin)/admin/analytics/page.tsx:
   - Date range picker
   - Overview metrics
   - Charts section
   - Export button

3. Create src/components/admin/analytics/date-range-picker.tsx:
   - Preset ranges (today, week, month, year)
   - Custom date picker
   - Compare to previous period toggle

4. Create src/components/admin/analytics/charts/users-chart.tsx:
   - New users over time
   - Line chart
   - Compare periods
   - Show registrations and active users

5. Create src/components/admin/analytics/charts/content-chart.tsx:
   - Content created over time
   - Stacked area chart
   - Posts, listings, threads breakdown

6. Create src/components/admin/analytics/charts/engagement-chart.tsx:
   - Likes, comments, shares over time
   - Bar chart
   - Daily/weekly aggregation

7. Create src/components/admin/analytics/metric-card.tsx:
   - Large number display
   - Change percentage
   - Sparkline mini chart
   - Click for details

8. Key metrics to display:
   - Daily Active Users (DAU)
   - Monthly Active Users (MAU)
   - New registrations
   - Posts created
   - Listings created
   - Messages sent
   - Engagement rate

9. Create export functionality:
   - Export as CSV
   - Date range selection
   - Metric selection
   - Download button

10. Add real-time updates (optional):
    - WebSocket for live stats
    - Auto-refresh every minute
```

### Prompt 6: Create Admin Settings

```
Create admin settings and configuration:

1. Create src/app/(admin)/admin/settings/page.tsx:
   - General settings form
   - Site name, description
   - Contact email
   - Maintenance mode toggle

2. Create src/app/(admin)/admin/settings/features/page.tsx:
   - Feature flags list
   - Toggle switches
   - Description for each flag
   - Last updated timestamp

3. Create src/components/admin/settings/feature-toggle.tsx:
   - Feature name and description
   - Toggle switch
   - Confirm dialog for critical features
   - Show who last changed it

4. Feature flags examples:
   - Enable registration
   - Enable marketplace
   - Enable forum
   - Enable stories
   - Enable push notifications
   - Maintenance mode
   - Require email verification

5. Create src/app/(admin)/admin/settings/announcements/page.tsx:
   - Active announcements list
   - Create new announcement
   - Edit/delete existing
   - Schedule announcements

6. Create src/components/admin/settings/announcement-form.tsx:
   - Title input
   - Content editor (rich text)
   - Type select (info, warning, maintenance)
   - Start date/time
   - End date/time (optional)
   - Target audience (all, verified, etc.)

7. Create announcements display:
   - Banner at top of main app
   - Dismissible by users
   - Track who dismissed

8. Additional settings:
   - Default listing duration
   - Story expiration time
   - Max images per post/listing
   - Profanity filter words
   - Blocked email domains

9. Create audit log:
   - Log all admin setting changes
   - Who changed what when
   - Previous and new values
```

---

## Testing Checklist

### Admin Access

- [ ] Non-admins cannot access admin routes
- [ ] Moderators have limited access
- [ ] Admin role check works

### Dashboard

- [ ] Stats cards display correctly
- [ ] Charts render
- [ ] Activity feed loads
- [ ] Quick actions work

### User Management

- [ ] Users list loads
- [ ] Search works
- [ ] Filters work
- [ ] Pagination works
- [ ] User details page loads
- [ ] Ban user works
- [ ] Unban user works
- [ ] Warn user works
- [ ] Role change works

### Content Moderation

- [ ] Content queues load
- [ ] Preview modal works
- [ ] Remove content works
- [ ] Hide content works
- [ ] Moderation log displays

### Reports

- [ ] Reports queue loads
- [ ] Filter by status works
- [ ] Report details load
- [ ] Resolve report works
- [ ] Dismiss report works
- [ ] User histories display

### Analytics

- [ ] Date range picker works
- [ ] Charts render correctly
- [ ] Metrics calculate correctly
- [ ] Export works

### Settings

- [ ] Settings form saves
- [ ] Feature toggles work
- [ ] Announcements create/edit/delete
- [ ] Changes are logged

---

## Completion Criteria

Phase 5 is complete when:

1. **Admin layout works** with proper access control
2. **Dashboard displays** stats and activity
3. **User management** works completely
4. **Content moderation** tools are functional
5. **Reports system** handles all report types
6. **Analytics** display correctly with charts
7. **Settings** can be modified and saved
8. **All actions are logged** for audit

---

## Notes

- Consider role hierarchy (admin > moderator > user)
- Log all admin actions for accountability
- Add confirmation for destructive actions
- Cache stats to reduce API load
- Consider real-time updates for reports queue
- Add keyboard shortcuts for common actions
- Mobile-friendly admin for urgent moderation
