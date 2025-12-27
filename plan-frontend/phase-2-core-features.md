# Phase 2: Core Features

## Overview

This phase focuses on building essential user features: user profiles with follow/block functionality, account settings, media upload capabilities, global search, and enhanced navigation. These features form the backbone of user interaction in the app.

## Goals

- Create complete user profile pages
- Implement follow/unfollow and block system
- Build comprehensive settings pages
- Create media upload functionality
- Implement global search
- Add notifications indicator

---

## Tasks

### 2.1 User Profiles

- [ ] Create user profile page layout
- [ ] Display user information (avatar, name, bio)
- [ ] Show follower/following counts
- [ ] Implement profile tabs (posts, listings, about)
- [ ] Add follow/unfollow button
- [ ] Add block/report functionality
- [ ] Create followers/following modal lists
- [ ] Implement profile sharing

### 2.2 Profile Editing

- [ ] Create edit profile page/modal
- [ ] Implement avatar upload with crop
- [ ] Implement cover photo upload
- [ ] Create bio editor
- [ ] Add location selector
- [ ] Implement website/social links
- [ ] Create username change (with validation)

### 2.3 Settings Pages

- [ ] Create settings layout with sidebar
- [ ] Build account settings page
- [ ] Create privacy settings page
- [ ] Implement notification preferences
- [ ] Create security settings (password change)
- [ ] Build blocked users management
- [ ] Add delete account flow

### 2.4 Media Upload

- [ ] Create image upload component
- [ ] Implement image cropping modal
- [ ] Add multi-image upload
- [ ] Create upload progress indicator
- [ ] Implement drag and drop
- [ ] Add image preview gallery
- [ ] Create image optimization client-side

### 2.5 Search Functionality

- [ ] Create global search modal (Cmd+K)
- [ ] Implement search input with debounce
- [ ] Create search results tabs (users, posts, listings, threads)
- [ ] Add recent searches
- [ ] Implement search suggestions
- [ ] Create dedicated search page

### 2.6 Navigation Enhancements

- [ ] Add breadcrumbs component
- [ ] Implement "Create" button with menu
- [ ] Add quick actions toolbar
- [ ] Create keyboard shortcuts
- [ ] Implement scroll to top button

---

## Technical Details

### Page Structure

```
src/app/(main)/
├── profile/
│   └── page.tsx                    # Current user profile (redirect to /[username])
├── [username]/
│   ├── page.tsx                    # Public user profile
│   ├── followers/
│   │   └── page.tsx                # Followers list
│   ├── following/
│   │   └── page.tsx                # Following list
│   └── loading.tsx
├── settings/
│   ├── layout.tsx                  # Settings sidebar layout
│   ├── page.tsx                    # Redirect to /settings/profile
│   ├── profile/
│   │   └── page.tsx                # Edit profile
│   ├── account/
│   │   └── page.tsx                # Account settings
│   ├── privacy/
│   │   └── page.tsx                # Privacy settings
│   ├── notifications/
│   │   └── page.tsx                # Notification preferences
│   ├── security/
│   │   └── page.tsx                # Password, sessions
│   └── blocked/
│       └── page.tsx                # Blocked users
└── search/
    └── page.tsx                    # Search results page
```

### Component Structure

```
src/components/
├── profile/
│   ├── profile-header.tsx          # Cover, avatar, name, follow btn
│   ├── profile-stats.tsx           # Posts, followers, following counts
│   ├── profile-tabs.tsx            # Posts, Listings, About tabs
│   ├── profile-about.tsx           # Bio, location, links
│   ├── profile-actions.tsx         # Follow, message, more menu
│   ├── follow-button.tsx           # Follow/unfollow button
│   ├── followers-list.tsx          # List of followers
│   ├── following-list.tsx          # List of following
│   └── user-card.tsx               # User card for lists
├── settings/
│   ├── settings-sidebar.tsx        # Settings navigation
│   ├── settings-section.tsx        # Section wrapper
│   ├── profile-form.tsx            # Edit profile form
│   ├── account-form.tsx            # Account settings form
│   ├── privacy-form.tsx            # Privacy settings form
│   ├── notification-form.tsx       # Notification preferences
│   ├── security-form.tsx           # Password change form
│   └── blocked-users-list.tsx      # Blocked users management
├── search/
│   ├── search-modal.tsx            # Global search modal (Cmd+K)
│   ├── search-input.tsx            # Search input with icon
│   ├── search-results.tsx          # Results container
│   ├── search-tabs.tsx             # All, Users, Posts, etc.
│   ├── user-search-result.tsx      # User result item
│   ├── post-search-result.tsx      # Post result item
│   └── recent-searches.tsx         # Recent search history
└── upload/
    ├── image-upload.tsx            # Single image upload
    ├── multi-image-upload.tsx      # Multiple images
    ├── image-cropper.tsx           # Image crop modal
    ├── upload-progress.tsx         # Progress indicator
    └── image-preview.tsx           # Preview with remove
```

### User Profile Types

```typescript
// types/user.ts
export interface User {
  id: string;
  email: string;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  location?: string;
  website?: string;
  dateOfBirth?: string;
  gender?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithProfile extends User {
  profile: UserProfile;
}

export interface PublicProfile {
  id: string;
  username: string;
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  location?: string;
  website?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isBlocked: boolean;
}

export interface UpdateProfileInput {
  username?: string;
  fullName?: string;
  bio?: string;
  location?: string;
  website?: string;
  dateOfBirth?: string;
  gender?: string;
}
```

### API Hooks

```typescript
// lib/api/hooks/use-profile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// Get public profile by username
export function useProfile(username: string) {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.get<ApiResponse<PublicProfile>>(`/users/username/${username}`),
    enabled: !!username,
  });
}

// Get current user profile
export function useCurrentProfile() {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => api.get<ApiResponse<UserWithProfile>>('/auth/me'),
  });
}

// Update profile
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileInput) =>
      api.patch<ApiResponse<UserProfile>>('/users/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Follow user
export function useFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      api.post<ApiResponse<void>>(`/users/${userId}/follow`),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
    },
  });
}

// Unfollow user
export function useUnfollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      api.delete<ApiResponse<void>>(`/users/${userId}/follow`),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
    },
  });
}

// Get followers
export function useFollowers(userId: string, page = 1) {
  return useQuery({
    queryKey: ['followers', userId, page],
    queryFn: () =>
      api.get<ApiResponse<PublicProfile[]>>(`/users/${userId}/followers`, {
        page: String(page),
        limit: '20',
      }),
    enabled: !!userId,
  });
}

// Get following
export function useFollowing(userId: string, page = 1) {
  return useQuery({
    queryKey: ['following', userId, page],
    queryFn: () =>
      api.get<ApiResponse<PublicProfile[]>>(`/users/${userId}/following`, {
        page: String(page),
        limit: '20',
      }),
    enabled: !!userId,
  });
}

// Block user
export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      api.post<ApiResponse<void>>(`/users/${userId}/block`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
    },
  });
}

// Unblock user
export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      api.delete<ApiResponse<void>>(`/users/${userId}/block`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
    },
  });
}

// Get blocked users
export function useBlockedUsers() {
  return useQuery({
    queryKey: ['blocked'],
    queryFn: () => api.get<ApiResponse<PublicProfile[]>>('/users/blocked'),
  });
}

// Search users
export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['search', 'users', query],
    queryFn: () =>
      api.get<ApiResponse<PublicProfile[]>>('/users/search', { q: query }),
    enabled: query.length >= 2,
  });
}

// Upload avatar
export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<ApiResponse<{ url: string }>>('/users/avatar', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Upload cover
export function useUploadCover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<ApiResponse<{ url: string }>>('/users/cover', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
```

### Settings Form Schemas

```typescript
// lib/validations/settings.ts
import { z } from 'zod';

export const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  fullName: z.string().min(2, 'Full name is required').max(100),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  location: z.string().max(100).optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
});

export const accountSchema = z.object({
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
});

export const privacySchema = z.object({
  profileVisibility: z.enum(['public', 'followers', 'private']),
  showOnlineStatus: z.boolean(),
  allowMessages: z.enum(['everyone', 'followers', 'nobody']),
  showActivityStatus: z.boolean(),
});

export const notificationSchema = z.object({
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  newFollower: z.boolean(),
  postLike: z.boolean(),
  postComment: z.boolean(),
  commentReply: z.boolean(),
  newMessage: z.boolean(),
  threadReply: z.boolean(),
  listingInquiry: z.boolean(),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase letter')
      .regex(/[a-z]/, 'Must contain lowercase letter')
      .regex(/[0-9]/, 'Must contain number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ProfileFormData = z.infer<typeof profileSchema>;
export type AccountFormData = z.infer<typeof accountSchema>;
export type PrivacyFormData = z.infer<typeof privacySchema>;
export type NotificationFormData = z.infer<typeof notificationSchema>;
export type PasswordFormData = z.infer<typeof passwordSchema>;
```

### Image Cropper Component

```typescript
// components/upload/image-cropper.tsx
'use client';

import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface ImageCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedImage: Blob) => void;
  aspect?: number;
  cropShape?: 'rect' | 'round';
}

export function ImageCropper({
  image,
  open,
  onClose,
  onCropComplete,
  aspect = 1,
  cropShape = 'round',
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteHandler = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    const croppedImage = await getCroppedImg(image, croppedAreaPixels);
    onCropComplete(croppedImage);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        <div className="relative h-[300px] w-full">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteHandler}
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Zoom</span>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={([value]) => setZoom(value)}
            className="flex-1"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Utility function to crop the image
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('No 2d context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
    }, 'image/jpeg', 0.9);
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = url;
  });
}
```

### Search Modal Component

```typescript
// components/search/search-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearchUsers } from '@/lib/api/hooks/use-profile';
import { Search, User, FileText, Store, MessageSquare } from 'lucide-react';

export function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const router = useRouter();

  const { data: users, isLoading } = useSearchUsers(debouncedQuery);

  // Keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (value: string) => {
    setOpen(false);
    setQuery('');
    router.push(value);
  };

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search...</span>
        <kbd className="hidden rounded bg-muted px-1.5 text-xs md:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search users, posts, listings..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {!isLoading && query.length >= 2 && (
            <>
              <CommandEmpty>No results found.</CommandEmpty>

              {users?.data && users.data.length > 0 && (
                <CommandGroup heading="Users">
                  {users.data.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`/${user.username}`}
                      onSelect={handleSelect}
                    >
                      <Avatar className="mr-2 h-8 w-8">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback>
                          {user.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.fullName}</span>
                        <span className="text-sm text-muted-foreground">
                          @{user.username}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Quick links */}
              <CommandGroup heading="Quick Links">
                <CommandItem
                  value="/search?q="
                  onSelect={() => handleSelect(`/search?q=${query}`)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search all for "{query}"
                </CommandItem>
                <CommandItem
                  value="/search?type=posts"
                  onSelect={() => handleSelect(`/search?q=${query}&type=posts`)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Search posts
                </CommandItem>
                <CommandItem
                  value="/search?type=listings"
                  onSelect={() => handleSelect(`/search?q=${query}&type=listings`)}
                >
                  <Store className="mr-2 h-4 w-4" />
                  Search marketplace
                </CommandItem>
                <CommandItem
                  value="/search?type=threads"
                  onSelect={() => handleSelect(`/search?q=${query}&type=threads`)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Search forum
                </CommandItem>
              </CommandGroup>
            </>
          )}

          {!query && (
            <CommandGroup heading="Recent Searches">
              {/* Load from localStorage */}
              <CommandItem value="/" onSelect={handleSelect}>
                <User className="mr-2 h-4 w-4" />
                Browse users
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

---

## Claude Code Prompts

### Prompt 1: Create User Profile Page

```
Create the user profile page and components:

1. Create src/app/(main)/[username]/page.tsx:
   - Fetch user profile by username
   - Handle loading and error states
   - 404 if user not found
   - SSR with generateMetadata for SEO

2. Create src/components/profile/profile-header.tsx:
   - Cover photo with upload button (if own profile)
   - Avatar with online indicator
   - Full name and username
   - Bio text
   - Location and website link
   - Joined date
   - Edit profile button (if own profile)
   - Follow button (if not own profile)
   - More menu (block, report)

3. Create src/components/profile/profile-stats.tsx:
   - Posts count
   - Followers count (clickable)
   - Following count (clickable)
   - Animate count changes

4. Create src/components/profile/profile-tabs.tsx:
   - Posts tab (default)
   - Listings tab
   - Parts tab
   - About tab
   - Tab content areas

5. Create src/components/profile/profile-actions.tsx:
   - Follow/Unfollow button with loading state
   - Message button
   - More dropdown (share, block, report)

6. Create src/components/profile/follow-button.tsx:
   - Follow state (Follow, Following, Follow Back)
   - Hover state (Following -> Unfollow)
   - Loading state
   - Optimistic updates

7. Create API hooks in src/lib/api/hooks/use-profile.ts:
   - useProfile(username)
   - useFollow()
   - useUnfollow()
   - useBlockUser()

8. Handle edge cases:
   - Private profile view
   - Blocked user view
   - Own profile view
   - Not found
```

### Prompt 2: Create Followers/Following Lists

```
Create the followers and following list pages:

1. Create src/app/(main)/[username]/followers/page.tsx:
   - Page title: "{name}'s Followers"
   - Infinite scroll list
   - Empty state if no followers

2. Create src/app/(main)/[username]/following/page.tsx:
   - Page title: "{name} is Following"
   - Infinite scroll list
   - Empty state if not following anyone

3. Create src/components/profile/user-card.tsx:
   - Avatar
   - Full name and username
   - Short bio preview
   - Follow button
   - Link to profile

4. Create src/components/profile/followers-list.tsx:
   - List of UserCard components
   - Infinite scroll with useInfiniteQuery
   - Loading skeletons
   - Empty state

5. Create modal versions for profile page:
   src/components/profile/followers-modal.tsx
   - Dialog with list
   - Triggered by clicking follower count

   src/components/profile/following-modal.tsx
   - Dialog with list
   - Triggered by clicking following count

6. Add mutual followers indicator:
   - Show "Followed by X and Y others you follow"

7. API hooks:
   - useFollowers(userId, page)
   - useFollowing(userId, page)
   - useInfiniteFollowers(userId)
   - useInfiniteFollowing(userId)
```

### Prompt 3: Create Edit Profile Page

```
Create the profile editing functionality:

1. Create src/app/(main)/settings/profile/page.tsx:
   - Form for editing profile
   - Avatar and cover upload
   - Preview changes

2. Create src/components/settings/profile-form.tsx:
   - Form using react-hook-form + zod
   - Fields:
     - Username (with availability check)
     - Full name
     - Bio (textarea with character count)
     - Location (with autocomplete - optional)
     - Website
     - Date of birth (date picker)
     - Gender (select)
   - Save button with loading state
   - Reset button

3. Create avatar upload section:
   - Current avatar preview
   - Upload button
   - Remove button
   - Crop modal (circular crop, 1:1 aspect)
   - Upload progress

4. Create cover upload section:
   - Current cover preview
   - Upload button
   - Remove button
   - Crop modal (16:9 or 3:1 aspect)
   - Upload progress

5. Create username availability hook:
   src/hooks/use-username-check.ts
   - Debounced check
   - Show available/taken indicator
   - Loading state

6. Validation:
   - Username: 3-20 chars, alphanumeric + underscore, unique
   - Full name: required, 2-100 chars
   - Bio: max 500 chars
   - Website: valid URL or empty

7. Handle errors:
   - Username taken
   - Upload failed
   - Save failed
   - Show toast notifications
```

### Prompt 4: Create Settings Pages

```
Create the settings section with all pages:

1. Create src/app/(main)/settings/layout.tsx:
   - Sidebar navigation
   - Main content area
   - Mobile: top tabs or dropdown
   - Breadcrumbs

2. Create src/components/settings/settings-sidebar.tsx:
   - Navigation items:
     - Edit Profile
     - Account
     - Privacy
     - Notifications
     - Security
     - Blocked Users
   - Active state
   - Icons for each item

3. Create src/app/(main)/settings/account/page.tsx:
   - Email (with verification status)
   - Phone number
   - Language preference
   - Delete account link

4. Create src/app/(main)/settings/privacy/page.tsx:
   - Profile visibility (public/followers/private)
   - Online status visibility
   - Who can message me
   - Activity status

5. Create src/app/(main)/settings/notifications/page.tsx:
   - Master toggles (push, email)
   - Per-type settings:
     - New followers
     - Post likes
     - Post comments
     - Comment replies
     - New messages
     - Thread replies
     - Listing inquiries
   - Save automatically on change

6. Create src/app/(main)/settings/security/page.tsx:
   - Change password form
   - Active sessions list (future)
   - Two-factor auth (future)
   - Login history (future)

7. Create src/app/(main)/settings/blocked/page.tsx:
   - List of blocked users
   - Unblock button
   - Empty state
   - Search blocked users

8. Create delete account flow:
   - Confirmation dialog
   - Password confirmation
   - Reason selection (optional)
   - Final confirmation
   - Redirect to goodbye page
```

### Prompt 5: Create Media Upload Components

```
Create reusable media upload components:

1. Install required packages:
   - react-dropzone
   - react-easy-crop
   - browser-image-compression

2. Create src/components/upload/image-upload.tsx:
   - Single image upload
   - Drag and drop zone
   - Click to browse
   - File type validation (jpeg, png, webp)
   - File size validation (configurable)
   - Preview with remove button
   - Upload progress indicator
   - Error state

3. Create src/components/upload/multi-image-upload.tsx:
   - Multiple image upload
   - Max images limit (configurable)
   - Drag to reorder
   - Individual remove buttons
   - Batch upload progress
   - Return array of URLs

4. Create src/components/upload/image-cropper.tsx:
   - Modal with crop area
   - Zoom slider
   - Aspect ratio prop (1:1, 16:9, 4:3)
   - Crop shape (round, rect)
   - Save/cancel buttons
   - Output cropped blob

5. Create src/components/upload/upload-progress.tsx:
   - Progress bar
   - Percentage text
   - Cancel button
   - Success/error states

6. Create src/hooks/use-image-upload.ts:
   - Handle file selection
   - Client-side compression
   - Upload to API
   - Return: upload, isUploading, progress, error

7. Create utility functions:
   src/lib/upload-utils.ts
   - validateImage(file, options)
   - compressImage(file, options)
   - getImageDimensions(file)
   - createImagePreview(file)

8. Integration examples:
   - Avatar upload with circular crop
   - Cover upload with 3:1 crop
   - Post images (multiple, rectangular)
   - Listing images (multiple, 4:3)
```

### Prompt 6: Create Global Search

```
Create the global search functionality:

1. Install command component from shadcn/ui:
   npx shadcn-ui@latest add command

2. Create src/components/search/search-modal.tsx:
   - CommandDialog from shadcn
   - Keyboard shortcut (Cmd+K / Ctrl+K)
   - Search input with debounce
   - Categorized results
   - Recent searches from localStorage
   - Loading and empty states

3. Create src/components/search/search-input.tsx:
   - Standalone search input for header
   - Search icon
   - Clear button
   - Keyboard hint

4. Create src/app/(main)/search/page.tsx:
   - Full search results page
   - URL query params (?q=term&type=users)
   - Tabs: All, Users, Posts, Listings, Forum
   - Filters per tab
   - Pagination/infinite scroll

5. Create search result components:
   src/components/search/user-search-result.tsx
   - Avatar, name, username
   - Followers count
   - Follow button

   src/components/search/post-search-result.tsx
   - Author info
   - Content preview
   - Stats (likes, comments)

   src/components/search/listing-search-result.tsx
   - Image thumbnail
   - Title, price
   - Condition, location

   src/components/search/thread-search-result.tsx
   - Title
   - Category badge
   - Author, replies count

6. Create API hooks:
   src/lib/api/hooks/use-search.ts
   - useGlobalSearch(query) - combined results
   - useSearchUsers(query)
   - useSearchPosts(query)
   - useSearchListings(query)
   - useSearchThreads(query)

7. Recent searches:
   - Store in localStorage
   - Max 10 items
   - Clear all button
   - Remove individual items

8. Add to header:
   - Search button/input
   - Open modal on click
   - Show on all pages
```

---

## Testing Checklist

### Profile Tests

- [ ] Profile page loads correctly
- [ ] Profile shows correct user data
- [ ] Follow button works
- [ ] Unfollow button works
- [ ] Block user works
- [ ] Followers list loads
- [ ] Following list loads
- [ ] Edit profile works
- [ ] Avatar upload works
- [ ] Cover upload works

### Settings Tests

- [ ] Settings sidebar navigation works
- [ ] Profile form validates correctly
- [ ] Account settings save correctly
- [ ] Privacy settings save correctly
- [ ] Notification preferences save correctly
- [ ] Password change works
- [ ] Blocked users list loads
- [ ] Unblock user works

### Upload Tests

- [ ] Single image upload works
- [ ] Multiple image upload works
- [ ] Image cropper works
- [ ] Progress indicator shows
- [ ] File validation works
- [ ] Large files are compressed
- [ ] Upload errors are handled

### Search Tests

- [ ] Search modal opens with Cmd+K
- [ ] Search results appear
- [ ] Results are categorized
- [ ] Recent searches are saved
- [ ] Search page shows results
- [ ] Tabs filter correctly
- [ ] Empty state shows

### Responsive Tests

- [ ] Profile page on mobile
- [ ] Settings on mobile
- [ ] Search modal on mobile
- [ ] Image cropper on mobile

---

## Completion Criteria

Phase 2 is complete when:

1. **User profiles work** - view, follow, block
2. **Profile editing works** - all fields, avatar, cover
3. **Settings pages work** - all sections functional
4. **Media upload works** - single, multiple, with crop
5. **Search works** - global search, dedicated page
6. **All forms validate** correctly with Zod
7. **Responsive design** works on all screen sizes
8. **API integration** is complete for all features

---

## Notes

- Cache profile data aggressively
- Optimize images before upload
- Debounce search queries (300ms)
- Use optimistic updates for follow/unfollow
- Store recent searches in localStorage
- Add skeleton loading for all lists
- Consider virtualization for long lists
