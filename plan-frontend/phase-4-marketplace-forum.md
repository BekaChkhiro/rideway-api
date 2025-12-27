# Phase 4: Marketplace & Forum

## Overview

This phase implements the business-oriented features: marketplace for motorcycle listings, parts catalog, forum for community discussions, and services directory. These features provide value beyond social interaction and help monetize the platform.

## Goals

- Build complete marketplace with listings
- Create parts catalog with compatibility search
- Implement forum with categories and threads
- Build services directory with reviews
- Add location-based search for listings and services

---

## Tasks

### 4.1 Marketplace - Listings

- [ ] Create listings browse page
- [ ] Implement listing filters and search
- [ ] Build listing card component
- [ ] Create single listing page
- [ ] Implement listing creation form
- [ ] Add image gallery with zoom
- [ ] Build favorites/wishlist functionality
- [ ] Create seller contact modal
- [ ] Add listing status management

### 4.2 Marketplace - Parts

- [ ] Create parts browse page
- [ ] Implement parts filters
- [ ] Build part card component
- [ ] Create single part page
- [ ] Implement part creation form
- [ ] Add compatibility search
- [ ] Build parts categories navigation

### 4.3 Forum

- [ ] Create forum categories page
- [ ] Build category listing page
- [ ] Create thread view page
- [ ] Implement thread creation
- [ ] Build reply system
- [ ] Add thread likes and subscriptions
- [ ] Implement thread search
- [ ] Add pinned and locked threads

### 4.4 Services

- [ ] Create services directory page
- [ ] Implement location-based search
- [ ] Build service card component
- [ ] Create single service page
- [ ] Add review and rating system
- [ ] Implement service creation (for business users)
- [ ] Build working hours display
- [ ] Add map integration

---

## Technical Details

### Page Structure

```
src/app/(main)/
├── marketplace/
│   ├── page.tsx                    # Listings browse
│   ├── [id]/
│   │   └── page.tsx                # Single listing
│   ├── create/
│   │   └── page.tsx                # Create listing
│   ├── favorites/
│   │   └── page.tsx                # User's favorites
│   └── my-listings/
│       └── page.tsx                # User's listings
├── parts/
│   ├── page.tsx                    # Parts browse
│   ├── [id]/
│   │   └── page.tsx                # Single part
│   └── create/
│       └── page.tsx                # Create part listing
├── forum/
│   ├── page.tsx                    # Forum categories
│   ├── [category]/
│   │   └── page.tsx                # Category threads
│   └── thread/
│       └── [id]/
│           └── page.tsx            # Thread view
├── services/
│   ├── page.tsx                    # Services directory
│   ├── [id]/
│   │   └── page.tsx                # Single service
│   └── nearby/
│       └── page.tsx                # Nearby services (map)
```

### Component Structure

```
src/components/
├── marketplace/
│   ├── listing-card.tsx            # Listing preview card
│   ├── listing-grid.tsx            # Grid of listings
│   ├── listing-filters.tsx         # Filter sidebar/modal
│   ├── listing-gallery.tsx         # Image gallery
│   ├── listing-details.tsx         # Listing info section
│   ├── seller-info.tsx             # Seller card
│   ├── contact-modal.tsx           # Contact seller modal
│   ├── create-listing-form.tsx     # Multi-step form
│   └── favorite-button.tsx         # Heart button
├── parts/
│   ├── part-card.tsx               # Part preview card
│   ├── parts-grid.tsx              # Grid of parts
│   ├── parts-filters.tsx           # Filter sidebar
│   ├── compatibility-search.tsx    # Model compatibility
│   └── create-part-form.tsx        # Part creation form
├── forum/
│   ├── category-card.tsx           # Forum category card
│   ├── categories-grid.tsx         # Categories list
│   ├── thread-card.tsx             # Thread preview
│   ├── thread-list.tsx             # List of threads
│   ├── thread-content.tsx          # Thread post
│   ├── thread-replies.tsx          # Reply section
│   ├── create-thread-form.tsx      # New thread form
│   ├── reply-form.tsx              # Reply to thread
│   └── thread-actions.tsx          # Like, subscribe, etc.
└── services/
    ├── service-card.tsx            # Service preview
    ├── services-grid.tsx           # Grid of services
    ├── services-filters.tsx        # Filter sidebar
    ├── service-details.tsx         # Service info
    ├── working-hours.tsx           # Hours display
    ├── reviews-section.tsx         # Reviews list
    ├── review-form.tsx             # Write review
    ├── rating-display.tsx          # Stars display
    └── services-map.tsx            # Map with markers
```

### Types

```typescript
// types/marketplace.ts
export interface ListingCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  parentId?: string;
  children?: ListingCategory[];
}

export interface Listing {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  condition: 'new' | 'used' | 'like_new';
  location?: string;
  latitude?: number;
  longitude?: number;
  status: 'active' | 'sold' | 'expired' | 'draft';
  viewsCount: number;
  isFeatured: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  category: ListingCategory;
  images: ListingImage[];
  isFavorite: boolean;
}

export interface ListingImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  sortOrder: number;
}

export interface ListingFilters {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  location?: string;
  status?: string;
  sortBy?: 'newest' | 'oldest' | 'price_asc' | 'price_desc';
}

export interface Part {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  condition: 'new' | 'used' | 'refurbished';
  brand?: string;
  partNumber?: string;
  compatibility: string[]; // Compatible motorcycle models
  location?: string;
  status: 'active' | 'sold';
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  images: { url: string; thumbnailUrl?: string }[];
}

// types/forum.ts
export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  threadsCount: number;
}

export interface ForumThread {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  content: string;
  viewsCount: number;
  repliesCount: number;
  likesCount: number;
  isPinned: boolean;
  isLocked: boolean;
  lastReplyAt?: string;
  lastReplyUserId?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  category: ForumCategory;
  isLiked: boolean;
  isSubscribed: boolean;
}

export interface ThreadReply {
  id: string;
  threadId: string;
  userId: string;
  parentId?: string;
  content: string;
  likesCount: number;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  isLiked: boolean;
  replies?: ThreadReply[];
}

// types/services.ts
export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface Service {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  website?: string;
  workingHours: Record<string, { open: string; close: string } | null>;
  ratingAvg: number;
  reviewsCount: number;
  isVerified: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  category: ServiceCategory;
  images: { url: string; isPrimary: boolean }[];
  distance?: number; // When searching nearby
}

export interface ServiceReview {
  id: string;
  serviceId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
}
```

### API Hooks

```typescript
// lib/api/hooks/use-marketplace.ts
export function useListings(filters: ListingFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['listings', filters],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ApiResponse<Listing[]>>('/listings', {
        ...filters,
        page: String(pageParam),
        limit: '12',
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 12) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
  });
}

export function useListing(id: string) {
  return useQuery({
    queryKey: ['listings', id],
    queryFn: () => api.get<ApiResponse<Listing>>(`/listings/${id}`),
    enabled: !!id,
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: FormData) =>
      api.upload<ApiResponse<Listing>>('/listings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}

export function useUpdateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      api.upload<ApiResponse<Listing>>(`/listings/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['listings', id] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      isFavorite
        ? api.delete<ApiResponse<void>>(`/listings/${id}/favorite`)
        : api.post<ApiResponse<void>>(`/listings/${id}/favorite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: () => api.get<ApiResponse<Listing[]>>('/listings/favorites'),
  });
}

export function useListingCategories() {
  return useQuery({
    queryKey: ['listing-categories'],
    queryFn: () => api.get<ApiResponse<ListingCategory[]>>('/listings/categories'),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
```

```typescript
// lib/api/hooks/use-forum.ts
export function useForumCategories() {
  return useQuery({
    queryKey: ['forum-categories'],
    queryFn: () => api.get<ApiResponse<ForumCategory[]>>('/forum/categories'),
    staleTime: 60 * 60 * 1000,
  });
}

export function useCategoryThreads(categorySlug: string, sortBy: string = 'latest') {
  return useInfiniteQuery({
    queryKey: ['forum-threads', categorySlug, sortBy],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ApiResponse<ForumThread[]>>(`/forum/categories/${categorySlug}`, {
        sortBy,
        page: String(pageParam),
        limit: '20',
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 20) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
    enabled: !!categorySlug,
  });
}

export function useThread(id: string) {
  return useQuery({
    queryKey: ['forum-thread', id],
    queryFn: () => api.get<ApiResponse<ForumThread>>(`/forum/threads/${id}`),
    enabled: !!id,
  });
}

export function useThreadReplies(threadId: string) {
  return useInfiniteQuery({
    queryKey: ['thread-replies', threadId],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ApiResponse<ThreadReply[]>>(`/forum/threads/${threadId}/replies`, {
        page: String(pageParam),
        limit: '20',
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 20) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
    enabled: !!threadId,
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { categoryId: string; title: string; content: string }) =>
      api.post<ApiResponse<ForumThread>>('/forum/threads', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-threads'] });
    },
  });
}

export function useCreateReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threadId,
      content,
      parentId,
    }: {
      threadId: string;
      content: string;
      parentId?: string;
    }) =>
      api.post<ApiResponse<ThreadReply>>(`/forum/threads/${threadId}/replies`, {
        content,
        parentId,
      }),
    onSuccess: (_, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ['thread-replies', threadId] });
      queryClient.invalidateQueries({ queryKey: ['forum-thread', threadId] });
    },
  });
}

export function useLikeThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) =>
      api.post<ApiResponse<void>>(`/forum/threads/${threadId}/like`),
    onSuccess: (_, threadId) => {
      queryClient.invalidateQueries({ queryKey: ['forum-thread', threadId] });
    },
  });
}

export function useSubscribeThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, subscribed }: { threadId: string; subscribed: boolean }) =>
      subscribed
        ? api.delete<ApiResponse<void>>(`/forum/threads/${threadId}/subscribe`)
        : api.post<ApiResponse<void>>(`/forum/threads/${threadId}/subscribe`),
    onSuccess: (_, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ['forum-thread', threadId] });
    },
  });
}
```

```typescript
// lib/api/hooks/use-services.ts
export function useServices(filters: {
  categoryId?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  minRating?: number;
} = {}) {
  return useInfiniteQuery({
    queryKey: ['services', filters],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ApiResponse<Service[]>>('/services', {
        ...Object.fromEntries(
          Object.entries(filters).map(([k, v]) => [k, String(v)])
        ),
        page: String(pageParam),
        limit: '12',
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 12) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
  });
}

export function useNearbyServices(lat: number, lng: number, radius: number = 10) {
  return useQuery({
    queryKey: ['services', 'nearby', lat, lng, radius],
    queryFn: () =>
      api.get<ApiResponse<Service[]>>('/services/nearby', {
        lat: String(lat),
        lng: String(lng),
        radius: String(radius),
      }),
    enabled: !!lat && !!lng,
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: ['services', id],
    queryFn: () => api.get<ApiResponse<Service>>(`/services/${id}`),
    enabled: !!id,
  });
}

export function useServiceReviews(serviceId: string) {
  return useInfiniteQuery({
    queryKey: ['service-reviews', serviceId],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ApiResponse<ServiceReview[]>>(`/services/${serviceId}/reviews`, {
        page: String(pageParam),
        limit: '10',
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 10) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
    enabled: !!serviceId,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      serviceId,
      rating,
      comment,
    }: {
      serviceId: string;
      rating: number;
      comment?: string;
    }) =>
      api.post<ApiResponse<ServiceReview>>(`/services/${serviceId}/reviews`, {
        rating,
        comment,
      }),
    onSuccess: (_, { serviceId }) => {
      queryClient.invalidateQueries({ queryKey: ['services', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['service-reviews', serviceId] });
    },
  });
}
```

---

## Claude Code Prompts

### Prompt 1: Create Marketplace Listings

```
Create the marketplace listings feature:

1. Create src/app/(main)/marketplace/page.tsx:
   - Grid of listing cards
   - Filters sidebar (desktop) / modal (mobile)
   - Search input
   - Sort dropdown
   - Infinite scroll
   - Empty state

2. Create src/components/marketplace/listing-card.tsx:
   - Main image
   - Title
   - Price with currency
   - Location
   - Condition badge
   - Favorite button (heart)
   - Time ago

3. Create src/components/marketplace/listing-filters.tsx:
   - Category select (hierarchical)
   - Price range (min/max inputs)
   - Condition select (new, used, like new)
   - Location input
   - Clear filters button
   - Apply button (mobile)

4. Create src/app/(main)/marketplace/[id]/page.tsx:
   - Image gallery with thumbnails
   - Title, price, condition
   - Description
   - Seller info card
   - Contact button
   - Favorite button
   - Share button
   - Similar listings
   - SEO metadata

5. Create src/components/marketplace/listing-gallery.tsx:
   - Main image display
   - Thumbnail strip
   - Click to zoom (lightbox)
   - Swipe on mobile
   - Image counter

6. Create src/components/marketplace/seller-info.tsx:
   - Avatar, name, username
   - Member since
   - Active listings count
   - Rating (if reviews exist)
   - View profile link
   - Contact button

7. Create src/components/marketplace/contact-modal.tsx:
   - Message textarea
   - Send button
   - Or show phone number
   - Report listing link

8. Create favorite functionality:
   - Toggle favorite with animation
   - Add to favorites list
   - Optimistic update
```

### Prompt 2: Create Listing Form

```
Create listing creation and editing:

1. Create src/app/(main)/marketplace/create/page.tsx:
   - Multi-step form
   - Progress indicator
   - Save draft functionality

2. Create src/components/marketplace/create-listing-form.tsx:
   Step 1 - Basic Info:
   - Title input
   - Category select (hierarchical)
   - Condition select
   - Price input with currency

   Step 2 - Description:
   - Rich text description
   - Character count

   Step 3 - Images:
   - Drag and drop upload
   - Up to 10 images
   - Reorder images
   - Set main image

   Step 4 - Location:
   - Location input with autocomplete
   - Or use current location
   - Map preview

   Step 5 - Review:
   - Preview of listing
   - Publish button
   - Save as draft button

3. Form validation with Zod:
   - Title: required, 5-200 chars
   - Category: required
   - Price: required, positive number
   - At least 1 image
   - Description: max 5000 chars

4. Create editing mode:
   - Load existing listing data
   - Pre-fill all fields
   - Update existing images
   - Mark as sold button
   - Delete button

5. Create src/app/(main)/marketplace/my-listings/page.tsx:
   - List of user's listings
   - Status tabs (active, sold, draft)
   - Edit/delete actions
   - Renew expired listing

6. Create src/app/(main)/marketplace/favorites/page.tsx:
   - Grid of favorited listings
   - Remove from favorites
   - Empty state
```

### Prompt 3: Create Parts Catalog

```
Create the parts catalog feature:

1. Create src/app/(main)/parts/page.tsx:
   - Grid of part cards
   - Category filters
   - Compatibility search
   - Sort options
   - Infinite scroll

2. Create src/components/parts/part-card.tsx:
   - Image
   - Title
   - Price
   - Condition badge
   - Brand (if set)
   - Compatible with X models

3. Create src/components/parts/parts-filters.tsx:
   - Category tree
   - Condition (new, used, refurbished)
   - Price range
   - Brand filter
   - Compatibility filter

4. Create src/components/parts/compatibility-search.tsx:
   - "Find parts for your bike" section
   - Make/Model/Year selects
   - Search button
   - Show compatible parts

5. Create src/app/(main)/parts/[id]/page.tsx:
   - Part details
   - Compatibility list
   - Seller info
   - Contact button
   - Similar parts

6. Create src/app/(main)/parts/create/page.tsx:
   - Part creation form
   - Title, description
   - Category, condition, brand
   - Part number (optional)
   - Compatibility multi-select
   - Images upload
   - Price and location

7. Part-specific features:
   - Brand autocomplete
   - Part number search
   - Compatibility database
   - OEM vs aftermarket badge
```

### Prompt 4: Create Forum

```
Create the forum feature:

1. Create src/app/(main)/forum/page.tsx:
   - Forum categories grid
   - Category cards with stats
   - Recent activity summary
   - Create thread button

2. Create src/components/forum/category-card.tsx:
   - Icon with color
   - Name and description
   - Threads count
   - Last activity

3. Create src/app/(main)/forum/[category]/page.tsx:
   - Category header
   - Threads list
   - Sort options (latest, active, popular)
   - Create thread button
   - Infinite scroll

4. Create src/components/forum/thread-card.tsx:
   - Title (link to thread)
   - Author info
   - Stats (views, replies, likes)
   - Last reply info
   - Pinned/locked badges

5. Create src/app/(main)/forum/thread/[id]/page.tsx:
   - Thread content (original post)
   - Author info with join date, post count
   - Like and subscribe buttons
   - Replies section
   - Reply form
   - SEO metadata

6. Create src/components/forum/thread-content.tsx:
   - Author sidebar (desktop)
   - Content with formatting
   - Edit/delete buttons (if author)
   - Report button

7. Create src/components/forum/thread-replies.tsx:
   - List of replies
   - Nested replies (1 level)
   - Reply to specific reply
   - Load more replies
   - Infinite scroll

8. Create src/components/forum/create-thread-form.tsx:
   - Title input
   - Category select
   - Content editor (rich text)
   - Submit button
   - Preview toggle

9. Create src/components/forum/reply-form.tsx:
   - Content textarea
   - Submit button
   - Cancel button (if replying to specific)
   - Preview toggle

10. Thread actions:
    - Like with count
    - Subscribe for notifications
    - Share link
    - Report
```

### Prompt 5: Create Services Directory

```
Create the services directory feature:

1. Create src/app/(main)/services/page.tsx:
   - Services grid
   - Category filters
   - City/location filter
   - Map toggle
   - Sort by rating/distance

2. Create src/components/services/service-card.tsx:
   - Primary image
   - Name
   - Category badge
   - Rating (stars)
   - Reviews count
   - Address/city
   - Distance (if location available)

3. Create src/components/services/services-filters.tsx:
   - Category select
   - City input
   - "Near me" button
   - Minimum rating filter
   - Verified only toggle

4. Create src/app/(main)/services/[id]/page.tsx:
   - Image gallery
   - Service details
   - Contact info (phone, email, website)
   - Working hours
   - Map with location
   - Reviews section
   - Write review button

5. Create src/components/services/working-hours.tsx:
   - Days of week
   - Open/close times
   - "Open now" indicator
   - Handle closed days

6. Create src/components/services/reviews-section.tsx:
   - Overall rating display
   - Rating breakdown (5-star chart)
   - Reviews list
   - Load more
   - Write review form

7. Create src/components/services/review-form.tsx:
   - Star rating input
   - Comment textarea
   - Submit button
   - Edit existing review

8. Create src/components/services/rating-display.tsx:
   - Star icons
   - Average rating number
   - Reviews count

9. Create src/components/services/services-map.tsx:
   - Map with service markers
   - Click marker to see info
   - Cluster markers
   - User location
   - Radius circle

10. Create src/app/(main)/services/nearby/page.tsx:
    - Full-screen map view
    - Services as markers
    - List view toggle
    - Filter by category
```

### Prompt 6: Add Location Features

```
Implement location-based functionality:

1. Install map packages:
   - react-leaflet + leaflet (free)
   - OR @mapbox/mapbox-gl-js (better but paid)

2. Create src/hooks/use-geolocation.ts:
   - Request user location
   - Handle permission denied
   - Watch position updates
   - Return lat, lng, error, loading

3. Create src/components/shared/location-picker.tsx:
   - Text input with autocomplete
   - "Use my location" button
   - Map preview
   - Return coordinates + address

4. Create src/components/shared/map-view.tsx:
   - Leaflet or Mapbox map
   - Custom markers
   - Popup on marker click
   - Zoom controls
   - Fullscreen option

5. Create src/components/services/service-marker.tsx:
   - Custom marker icon
   - Category-colored
   - Popup with service info
   - Link to service page

6. Integrate location with:
   - Listing creation (set location)
   - Part creation (set location)
   - Services search (nearby)
   - User profile (location display)

7. Create distance calculations:
   - Display distance from user
   - Sort by distance
   - Filter by radius

8. Create src/lib/location-utils.ts:
   - formatDistance(meters)
   - calculateDistance(point1, point2)
   - isWithinRadius(point, center, radius)
```

---

## Testing Checklist

### Marketplace Tests

- [ ] Listings page loads with grid
- [ ] Filters work correctly
- [ ] Search works
- [ ] Listing details page loads
- [ ] Image gallery works
- [ ] Favorite toggle works
- [ ] Create listing form works
- [ ] Edit listing works
- [ ] Contact seller works

### Parts Tests

- [ ] Parts page loads
- [ ] Category filters work
- [ ] Compatibility search works
- [ ] Part details page loads
- [ ] Create part form works

### Forum Tests

- [ ] Categories page loads
- [ ] Category threads page loads
- [ ] Thread sort options work
- [ ] Thread page loads
- [ ] Replies load
- [ ] Create thread works
- [ ] Reply to thread works
- [ ] Reply to reply works
- [ ] Like thread works
- [ ] Subscribe works

### Services Tests

- [ ] Services page loads
- [ ] Filters work
- [ ] Location search works
- [ ] Service details page loads
- [ ] Working hours display correctly
- [ ] Map displays correctly
- [ ] Reviews load
- [ ] Write review works
- [ ] Edit review works

### Location Tests

- [ ] Geolocation permission works
- [ ] Location picker works
- [ ] Map markers display
- [ ] Nearby search works
- [ ] Distance calculations correct

---

## Completion Criteria

Phase 4 is complete when:

1. **Marketplace works** - browse, filter, create, favorite
2. **Parts catalog works** - browse, filter, compatibility
3. **Forum works** - categories, threads, replies
4. **Services work** - browse, location search, reviews
5. **Location features work** - maps, nearby, distance
6. **All forms validate** and submit correctly
7. **SEO metadata** is set for all pages
8. **Mobile experience** is smooth

---

## Notes

- Optimize images for marketplace listings
- Cache categories and frequently used data
- Consider pagination vs infinite scroll trade-offs
- Add "share" functionality for listings
- Monitor map API usage/costs
- Consider implementing saved searches
- Add email notifications for favorites price drops
