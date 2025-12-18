# Phase 3: Business Logic

## Overview

This phase implements the core business features of the application: Marketplace (listings and parts), Social (posts, stories, comments, votes), Forum (threads and discussions), and Services (business listings with reviews). These modules contain the main value proposition of the app.

## Goals

- Implement complete marketplace functionality
- Build social media features (posts, stories, feed)
- Create forum system with threads and comments
- Add service provider listings with reviews
- Establish efficient query patterns for feeds

---

## Tasks

### 3.1 Marketplace Module - Listings

- [ ] Create listing entity and migrations
- [ ] Implement listing CRUD endpoints
- [ ] Create listing categories system
- [ ] Implement image gallery for listings
- [ ] Add listing search with filters
- [ ] Implement favorites/wishlist
- [ ] Add listing status management (active, sold, expired)
- [ ] Create seller contact/inquiry system
- [ ] Add listing views counter
- [ ] Implement related listings

### 3.2 Marketplace Module - Parts

- [ ] Create parts entity and migrations
- [ ] Implement parts CRUD endpoints
- [ ] Create parts categories (engine, brakes, etc.)
- [ ] Add compatibility information
- [ ] Implement parts search with filters
- [ ] Add condition field (new, used, refurbished)

### 3.3 Social Module - Posts

- [ ] Create post entity and migrations
- [ ] Implement post CRUD endpoints
- [ ] Add multi-image support
- [ ] Implement post visibility (public, followers)
- [ ] Create hashtag system
- [ ] Implement user mentions
- [ ] Add post sharing/repost
- [ ] Create personalized feed algorithm

### 3.4 Social Module - Stories

- [ ] Create story entity and migrations
- [ ] Implement story CRUD endpoints
- [ ] Add 24-hour expiration
- [ ] Implement story views tracking
- [ ] Create story viewers list
- [ ] Add story highlights (save stories)

### 3.5 Social Module - Comments & Votes

- [ ] Create comment entity (nested/threaded)
- [ ] Implement comment CRUD endpoints
- [ ] Create vote entity (upvote/downvote)
- [ ] Implement vote endpoints
- [ ] Add comment sorting (newest, popular)
- [ ] Implement vote counts caching

### 3.6 Forum Module

- [ ] Create forum category entity
- [ ] Create thread entity
- [ ] Create forum comment entity
- [ ] Implement thread CRUD
- [ ] Add thread pinning and locking
- [ ] Implement forum search
- [ ] Add thread subscription/notifications

### 3.7 Services Module

- [ ] Create service provider entity
- [ ] Create service category entity
- [ ] Implement service CRUD
- [ ] Add location-based search
- [ ] Create review/rating system
- [ ] Implement service hours
- [ ] Add contact information management

---

## Technical Details

### Database Schema

```sql
-- =====================
-- MARKETPLACE TABLES
-- =====================

-- Listing Categories
CREATE TABLE listing_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50),
    parent_id UUID REFERENCES listing_categories(id),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Listings
CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES listing_categories(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GEL',
    condition VARCHAR(20), -- new, used, like_new
    location VARCHAR(200),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(20) DEFAULT 'active', -- active, sold, expired, draft
    views_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Listing Images
CREATE TABLE listing_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Listing Favorites
CREATE TABLE listing_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, listing_id)
);

-- Parts Categories
CREATE TABLE parts_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50),
    parent_id UUID REFERENCES parts_categories(id),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Parts
CREATE TABLE parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES parts_categories(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GEL',
    condition VARCHAR(20), -- new, used, refurbished
    brand VARCHAR(100),
    part_number VARCHAR(100),
    compatibility TEXT, -- JSON array of compatible models
    location VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active',
    views_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Part Images
CREATE TABLE part_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID REFERENCES parts(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- SOCIAL TABLES
-- =====================

-- Posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    visibility VARCHAR(20) DEFAULT 'public', -- public, followers, private
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    shares_count INT DEFAULT 0,
    is_edited BOOLEAN DEFAULT FALSE,
    original_post_id UUID REFERENCES posts(id), -- for reposts
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Post Images
CREATE TABLE post_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    width INT,
    height INT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Post Likes
CREATE TABLE post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- Hashtags
CREATE TABLE hashtags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    posts_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Post Hashtags
CREATE TABLE post_hashtags (
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    hashtag_id UUID REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, hashtag_id)
);

-- Stories
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    media_url VARCHAR(500) NOT NULL,
    media_type VARCHAR(20) DEFAULT 'image', -- image, video
    caption TEXT,
    views_count INT DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Story Views
CREATE TABLE story_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(story_id, user_id)
);

-- Comments (for posts)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    replies_count INT DEFAULT 0,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Comment Likes
CREATE TABLE comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

-- =====================
-- FORUM TABLES
-- =====================

-- Forum Categories
CREATE TABLE forum_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7),
    sort_order INT DEFAULT 0,
    threads_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Forum Threads
CREATE TABLE forum_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES forum_categories(id),
    title VARCHAR(300) NOT NULL,
    content TEXT NOT NULL,
    views_count INT DEFAULT 0,
    replies_count INT DEFAULT 0,
    likes_count INT DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    last_reply_at TIMESTAMP,
    last_reply_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Thread Replies
CREATE TABLE thread_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES thread_replies(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Thread Likes
CREATE TABLE thread_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, thread_id)
);

-- Thread Subscriptions
CREATE TABLE thread_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, thread_id)
);

-- =====================
-- SERVICES TABLES
-- =====================

-- Service Categories
CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Services
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES service_categories(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    address VARCHAR(300),
    city VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    working_hours JSONB, -- {"mon": {"open": "09:00", "close": "18:00"}, ...}
    rating_avg DECIMAL(2, 1) DEFAULT 0,
    reviews_count INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Service Images
CREATE TABLE service_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Service Reviews
CREATE TABLE service_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(service_id, user_id)
);

-- =====================
-- INDEXES
-- =====================

-- Listings
CREATE INDEX idx_listings_user ON listings(user_id);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_location ON listings USING GIST (point(longitude, latitude));
CREATE INDEX idx_listings_created ON listings(created_at DESC);

-- Posts
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_visibility ON posts(visibility);

-- Comments
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_created ON comments(created_at DESC);

-- Forum
CREATE INDEX idx_threads_category ON forum_threads(category_id);
CREATE INDEX idx_threads_created ON forum_threads(created_at DESC);
CREATE INDEX idx_threads_last_reply ON forum_threads(last_reply_at DESC);
CREATE INDEX idx_thread_replies_thread ON thread_replies(thread_id);

-- Services
CREATE INDEX idx_services_category ON services(category_id);
CREATE INDEX idx_services_location ON services USING GIST (point(longitude, latitude));
CREATE INDEX idx_services_rating ON services(rating_avg DESC);
```

### Feed Algorithm

```typescript
// Personalized Feed Algorithm
// Score = baseScore + recencyBoost + engagementBoost + followingBoost

interface FeedPost {
  id: string;
  score: number;
}

function calculateFeedScore(post: Post, currentUser: User): number {
  const now = Date.now();
  const postAge = now - post.createdAt.getTime();
  const hoursSincePost = postAge / (1000 * 60 * 60);

  // Base score from engagement
  const engagementScore =
    post.likesCount * 1 +
    post.commentsCount * 2 +
    post.sharesCount * 3;

  // Recency decay (half-life of 24 hours)
  const recencyMultiplier = Math.pow(0.5, hoursSincePost / 24);

  // Following boost (2x for followed users)
  const followingBoost = isFollowing(currentUser, post.userId) ? 2 : 1;

  // Interaction boost (higher for users you interact with)
  const interactionBoost = getInteractionScore(currentUser, post.userId);

  return engagementScore * recencyMultiplier * followingBoost * interactionBoost;
}
```

---

## Claude Code Prompts

### Prompt 1: Create Marketplace Listings Module

```
Create the marketplace listings module for the NestJS bike-area-api:

1. Create src/modules/marketplace/ directory structure:
   - marketplace.module.ts
   - listings/
     - listings.controller.ts
     - listings.service.ts
     - dto/
       - create-listing.dto.ts
       - update-listing.dto.ts
       - listing-query.dto.ts
     - entities/
       - listing.entity.ts
       - listing-image.entity.ts
       - listing-category.entity.ts
       - listing-favorite.entity.ts

2. Create entities with TypeORM:
   - ListingCategory: id, name, slug, icon, parentId, sortOrder
   - Listing: id, userId, categoryId, title, description, price, currency, condition, location, latitude, longitude, status, viewsCount, isFeatured, expiresAt, timestamps
   - ListingImage: id, listingId, url, thumbnailUrl, sortOrder
   - ListingFavorite: id, userId, listingId, createdAt

3. Implement ListingsService methods:
   - create(userId, dto): Create new listing with images
   - findAll(query): Paginated list with filters
   - findOne(id): Get listing with images and seller info
   - update(id, userId, dto): Update listing
   - delete(id, userId): Soft delete listing
   - incrementViews(id): Increment view counter
   - markAsSold(id, userId): Change status to sold
   - getByUser(userId, query): User's listings
   - search(query): Full-text search with filters

4. Implement ListingsController endpoints:
   POST   /listings              - Create listing
   GET    /listings              - List all (with filters)
   GET    /listings/:id          - Get single listing
   PATCH  /listings/:id          - Update listing
   DELETE /listings/:id          - Delete listing
   POST   /listings/:id/sold     - Mark as sold
   GET    /listings/user/:userId - User's listings
   GET    /listings/search       - Search listings

5. Query filters (listing-query.dto.ts):
   - categoryId: UUID
   - minPrice / maxPrice: number
   - condition: enum
   - location: string
   - radius: number (km, with lat/lng)
   - status: enum
   - sortBy: price_asc, price_desc, newest, oldest
   - page, limit

6. Add image upload integration:
   - Accept images during creation
   - Upload to R2 under listings/{listingId}/
   - Generate thumbnails
   - Return URLs in response

7. Add Redis caching for:
   - Category list (1 hour TTL)
   - Popular listings (5 min TTL)
   - Listing view counts (batch update)
```

### Prompt 2: Create Marketplace Parts Module

```
Create the parts submodule within marketplace:

1. Create src/modules/marketplace/parts/ directory:
   - parts.controller.ts
   - parts.service.ts
   - dto/
     - create-part.dto.ts
     - update-part.dto.ts
     - part-query.dto.ts
   - entities/
     - part.entity.ts
     - part-image.entity.ts
     - parts-category.entity.ts

2. Create entities:
   - PartsCategory: id, name, slug, icon, parentId, sortOrder
   - Part: id, userId, categoryId, title, description, price, currency, condition, brand, partNumber, compatibility (JSON), location, status, viewsCount, timestamps
   - PartImage: id, partId, url, thumbnailUrl, sortOrder

3. Implement PartsService methods:
   - create(userId, dto): Create part listing
   - findAll(query): Paginated with filters
   - findOne(id): Part details with seller
   - update(id, userId, dto): Update part
   - delete(id, userId): Soft delete
   - searchByCompatibility(model): Find compatible parts
   - getByUser(userId, query): User's parts

4. Implement PartsController endpoints:
   POST   /parts              - Create part
   GET    /parts              - List all
   GET    /parts/:id          - Get part
   PATCH  /parts/:id          - Update
   DELETE /parts/:id          - Delete
   GET    /parts/compatible   - Search by model compatibility
   GET    /parts/user/:userId - User's parts

5. Query filters:
   - categoryId
   - minPrice / maxPrice
   - condition: new, used, refurbished
   - brand
   - compatibleWith: motorcycle model
   - sortBy
   - page, limit

6. Compatibility search:
   - Store compatible models as JSON array
   - Search using JSON containment operators
   - Example: ["Honda CBR600", "Honda CBR1000"]
```

### Prompt 3: Create Social Posts Module

```
Create the social module with posts functionality:

1. Create src/modules/social/ directory structure:
   - social.module.ts
   - posts/
     - posts.controller.ts
     - posts.service.ts
     - dto/
       - create-post.dto.ts
       - update-post.dto.ts
       - post-query.dto.ts
     - entities/
       - post.entity.ts
       - post-image.entity.ts
       - post-like.entity.ts
       - hashtag.entity.ts
       - post-hashtag.entity.ts

2. Create entities:
   - Post: id, userId, content, visibility, likesCount, commentsCount, sharesCount, isEdited, originalPostId, timestamps
   - PostImage: id, postId, url, thumbnailUrl, width, height, sortOrder
   - PostLike: id, userId, postId, createdAt (unique user+post)
   - Hashtag: id, name (unique), postsCount
   - PostHashtag: postId, hashtagId (composite PK)

3. Implement PostsService methods:
   - create(userId, dto): Create post with images and hashtags
   - findOne(id, currentUserId?): Get post with engagement
   - update(id, userId, dto): Edit post content
   - delete(id, userId): Soft delete
   - like(id, userId): Like/unlike toggle
   - share(id, userId): Create repost
   - getFeed(userId, query): Personalized feed
   - getUserPosts(userId, query): User's posts
   - getByHashtag(hashtag, query): Posts with hashtag
   - extractHashtags(content): Parse hashtags from text

4. Implement PostsController endpoints:
   POST   /posts              - Create post
   GET    /posts/:id          - Get post
   PATCH  /posts/:id          - Update post
   DELETE /posts/:id          - Delete post
   POST   /posts/:id/like     - Like/unlike
   POST   /posts/:id/share    - Share/repost
   GET    /posts/feed         - Personalized feed
   GET    /posts/user/:userId - User's posts
   GET    /posts/hashtag/:tag - Posts by hashtag
   GET    /posts/trending     - Trending posts

5. Feed algorithm implementation:
   - Get posts from followed users
   - Add popular public posts
   - Score based on: recency, engagement, relationship
   - Exclude blocked users
   - Cache feed in Redis (short TTL)

6. Hashtag processing:
   - Extract hashtags on post create/update
   - Create hashtags if not exist
   - Increment/decrement postsCount
   - Trending hashtags query

7. Handle mentions:
   - Extract @username mentions
   - Store mention relationships
   - Trigger notifications (prepare for Phase 4)
```

### Prompt 4: Create Stories Module

```
Create the stories submodule within social:

1. Create src/modules/social/stories/ directory:
   - stories.controller.ts
   - stories.service.ts
   - dto/
     - create-story.dto.ts
   - entities/
     - story.entity.ts
     - story-view.entity.ts

2. Create entities:
   - Story: id, userId, mediaUrl, mediaType (image/video), caption, viewsCount, expiresAt, createdAt
   - StoryView: id, storyId, userId, viewedAt (unique story+user)

3. Implement StoriesService methods:
   - create(userId, dto): Create story (24h expiration)
   - findUserStories(userId): Get user's active stories
   - getFeedStories(currentUserId): Stories from followed users
   - markAsViewed(storyId, userId): Record view
   - getViewers(storyId, userId): List of viewers (owner only)
   - deleteExpired(): Cleanup job for expired stories
   - delete(id, userId): Manual delete

4. Implement StoriesController endpoints:
   POST   /stories              - Create story
   GET    /stories/feed         - Stories feed
   GET    /stories/user/:userId - User's stories
   GET    /stories/:id          - Get single story
   POST   /stories/:id/view     - Mark as viewed
   GET    /stories/:id/viewers  - Get viewers list
   DELETE /stories/:id          - Delete story

5. Story-specific logic:
   - Auto-set expiresAt to 24 hours from creation
   - Return stories grouped by user
   - Include hasViewed flag for current user
   - Sort users by latest story

6. Create scheduled job for cleanup:
   - Run every hour
   - Delete stories where expiresAt < now
   - Delete associated views
   - Clean up media from R2

7. Response format for feed:
   {
     users: [
       {
         userId,
         username,
         avatarUrl,
         hasUnviewed: boolean,
         stories: [
           { id, mediaUrl, mediaType, caption, viewsCount, createdAt, hasViewed }
         ]
       }
     ]
   }
```

### Prompt 5: Create Comments Module

```
Create the comments module for posts (nested/threaded):

1. Create src/modules/social/comments/ directory:
   - comments.controller.ts
   - comments.service.ts
   - dto/
     - create-comment.dto.ts
     - update-comment.dto.ts
     - comment-query.dto.ts
   - entities/
     - comment.entity.ts
     - comment-like.entity.ts

2. Create entities:
   - Comment: id, userId, postId, parentId (self-reference), content, likesCount, repliesCount, isEdited, timestamps
   - CommentLike: id, userId, commentId, createdAt (unique)

3. Implement CommentsService methods:
   - create(userId, postId, dto): Create comment/reply
   - findByPost(postId, query): Get root comments with replies
   - findReplies(commentId, query): Get replies to comment
   - update(id, userId, dto): Edit comment
   - delete(id, userId): Soft delete (keep replies)
   - like(id, userId): Like/unlike toggle
   - getCommentTree(postId): Full nested tree

4. Implement CommentsController endpoints:
   POST   /posts/:postId/comments           - Add comment
   GET    /posts/:postId/comments           - Get comments
   GET    /comments/:id/replies             - Get replies
   PATCH  /comments/:id                     - Edit comment
   DELETE /comments/:id                     - Delete comment
   POST   /comments/:id/like                - Like/unlike

5. Nested comments handling:
   - parentId null = root comment
   - parentId set = reply
   - Limit nesting depth to 2 levels
   - Flatten deeper replies to level 2

6. Query options:
   - sortBy: newest, oldest, popular
   - limit: default 20
   - cursor: for pagination

7. Update post.commentsCount on create/delete:
   - Use database triggers or service logic
   - Only count root comments + direct replies

8. Response format:
   {
     comments: [
       {
         id, content, likesCount, repliesCount, createdAt,
         user: { id, username, avatarUrl },
         isLiked: boolean,
         replies: [...] // first 3 replies
       }
     ],
     nextCursor,
     hasMore
   }
```

### Prompt 6: Create Forum Module

```
Create the forum module with threads and categories:

1. Create src/modules/forum/ directory structure:
   - forum.module.ts
   - categories/
     - categories.controller.ts
     - categories.service.ts
     - entities/forum-category.entity.ts
   - threads/
     - threads.controller.ts
     - threads.service.ts
     - dto/
       - create-thread.dto.ts
       - update-thread.dto.ts
       - thread-query.dto.ts
     - entities/
       - thread.entity.ts
       - thread-reply.entity.ts
       - thread-like.entity.ts
       - thread-subscription.entity.ts

2. Create entities:
   - ForumCategory: id, name, slug, description, icon, color, sortOrder, threadsCount
   - ForumThread: id, userId, categoryId, title, content, viewsCount, repliesCount, likesCount, isPinned, isLocked, lastReplyAt, lastReplyUserId, timestamps
   - ThreadReply: id, threadId, userId, parentId, content, likesCount, isEdited, timestamps
   - ThreadLike: id, userId, threadId, createdAt (unique)
   - ThreadSubscription: id, userId, threadId, createdAt (unique)

3. Implement CategoriesService:
   - findAll(): All categories with thread counts
   - findOne(slug): Category with recent threads

4. Implement ThreadsService:
   - create(userId, dto): Create thread
   - findAll(query): Paginated, filter by category
   - findOne(id): Thread with author, increment views
   - update(id, userId, dto): Edit thread
   - delete(id, userId): Soft delete
   - like(id, userId): Like/unlike
   - pin(id): Admin pin thread
   - lock(id): Admin lock thread
   - subscribe(id, userId): Subscribe/unsubscribe
   - getSubscribers(id): For notifications

5. Implement RepliesService:
   - create(threadId, userId, dto): Add reply
   - findByThread(threadId, query): Get replies
   - update(id, userId, dto): Edit reply
   - delete(id, userId): Soft delete
   - like(id, userId): Like/unlike

6. Controller endpoints:
   GET    /forum/categories              - List categories
   GET    /forum/categories/:slug        - Category threads

   POST   /forum/threads                 - Create thread
   GET    /forum/threads                 - List threads
   GET    /forum/threads/:id             - Get thread
   PATCH  /forum/threads/:id             - Update thread
   DELETE /forum/threads/:id             - Delete thread
   POST   /forum/threads/:id/like        - Like/unlike
   POST   /forum/threads/:id/subscribe   - Subscribe/unsub
   POST   /forum/threads/:id/pin         - Pin (admin)
   POST   /forum/threads/:id/lock        - Lock (admin)

   POST   /forum/threads/:id/replies     - Add reply
   GET    /forum/threads/:id/replies     - Get replies
   PATCH  /forum/replies/:id             - Edit reply
   DELETE /forum/replies/:id             - Delete reply
   POST   /forum/replies/:id/like        - Like/unlike

7. Thread listing sort options:
   - latest: by createdAt
   - active: by lastReplyAt
   - popular: by repliesCount
   - Filter: pinned threads first
```

### Prompt 7: Create Services Module

```
Create the services module for business listings:

1. Create src/modules/services/ directory structure:
   - services.module.ts
   - services.controller.ts
   - services.service.ts
   - dto/
     - create-service.dto.ts
     - update-service.dto.ts
     - service-query.dto.ts
     - create-review.dto.ts
   - entities/
     - service.entity.ts
     - service-category.entity.ts
     - service-image.entity.ts
     - service-review.entity.ts

2. Create entities:
   - ServiceCategory: id, name, slug, icon, sortOrder
   - Service: id, userId, categoryId, name, description, address, city, latitude, longitude, phone, email, website, workingHours (JSON), ratingAvg, reviewsCount, isVerified, status, timestamps
   - ServiceImage: id, serviceId, url, isPrimary, sortOrder
   - ServiceReview: id, serviceId, userId, rating (1-5), comment, timestamps (unique user+service)

3. Implement ServicesService:
   - create(userId, dto): Create service listing
   - findAll(query): Paginated with filters
   - findOne(id): Service with images and reviews
   - update(id, userId, dto): Update service
   - delete(id, userId): Soft delete
   - searchNearby(lat, lng, radius, query): Location search
   - addReview(serviceId, userId, dto): Add/update review
   - deleteReview(serviceId, userId): Remove review
   - updateRating(serviceId): Recalculate average
   - getByUser(userId): User's services

4. Controller endpoints:
   POST   /services              - Create service
   GET    /services              - List services
   GET    /services/nearby       - Search nearby
   GET    /services/:id          - Get service
   PATCH  /services/:id          - Update service
   DELETE /services/:id          - Delete service

   POST   /services/:id/reviews  - Add review
   GET    /services/:id/reviews  - Get reviews
   DELETE /services/:id/reviews  - Delete my review

5. Query filters:
   - categoryId
   - city
   - lat, lng, radius (nearby)
   - minRating
   - isVerified
   - sortBy: rating, newest, distance

6. Working hours format:
   {
     "mon": { "open": "09:00", "close": "18:00" },
     "tue": { "open": "09:00", "close": "18:00" },
     ...
     "sun": null // closed
   }

7. Rating calculation:
   - On review add/update/delete
   - Calculate average of all reviews
   - Update service.ratingAvg and reviewsCount

8. Location search implementation:
   - Use PostGIS or calculate distance with formula
   - Order by distance ascending
   - Return distance in response
```

---

## Testing Checklist

### Marketplace Tests

- [ ] Create listing with images
- [ ] List listings with pagination
- [ ] Filter by category, price, location
- [ ] Search listings by keyword
- [ ] Update listing
- [ ] Delete listing
- [ ] Mark as sold
- [ ] Add/remove from favorites
- [ ] View count increments
- [ ] Parts CRUD operations
- [ ] Parts compatibility search

### Social Tests

- [ ] Create post with images
- [ ] Create post with hashtags
- [ ] Hashtags are created/linked
- [ ] Update post
- [ ] Delete post
- [ ] Like/unlike post
- [ ] Share/repost works
- [ ] Feed shows followed users' posts
- [ ] Feed excludes blocked users
- [ ] Trending posts query works

### Stories Tests

- [ ] Create story with media
- [ ] Story expires after 24 hours
- [ ] Feed shows followed users' stories
- [ ] Mark story as viewed
- [ ] Viewers list shows correctly
- [ ] Delete story removes from R2

### Comments Tests

- [ ] Add comment to post
- [ ] Add reply to comment
- [ ] Nested replies work
- [ ] Edit comment
- [ ] Delete comment
- [ ] Like/unlike comment
- [ ] Post commentsCount updates

### Forum Tests

- [ ] List categories with counts
- [ ] Create thread
- [ ] List threads with filters
- [ ] View thread increments count
- [ ] Add reply
- [ ] Edit thread/reply
- [ ] Delete thread/reply
- [ ] Like thread/reply
- [ ] Pin/unpin thread
- [ ] Lock/unlock thread
- [ ] Subscribe to thread

### Services Tests

- [ ] Create service with images
- [ ] List services with filters
- [ ] Search nearby services
- [ ] Update service
- [ ] Delete service
- [ ] Add review
- [ ] Update review
- [ ] Delete review
- [ ] Rating average calculated correctly

---

## Completion Criteria

Phase 3 is complete when:

1. **Marketplace is fully functional**
   - Listings CRUD with images
   - Parts CRUD with compatibility
   - Search and filtering work
   - Favorites system works

2. **Social features work end-to-end**
   - Posts with images and hashtags
   - Stories with 24h expiration
   - Comments with nesting
   - Likes on posts and comments
   - Personalized feed

3. **Forum is operational**
   - Categories and threads
   - Replies with nesting
   - Pin/lock functionality
   - Subscriptions

4. **Services module complete**
   - Business listings with details
   - Location-based search
   - Review system with ratings

5. **All tests pass**

6. **Performance acceptable**
   - Feed loads < 500ms
   - Search responds < 300ms
   - Pagination works smoothly

---

## Notes

- Consider full-text search with PostgreSQL ts_vector or Elasticsearch later
- Monitor query performance and add indexes as needed
- Implement soft deletes consistently
- Cache frequently accessed data (categories, trending)
- Prepare notification triggers for Phase 4
