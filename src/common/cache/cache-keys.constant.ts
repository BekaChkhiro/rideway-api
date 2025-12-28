// Cache key patterns for the application
// Use these constants to ensure consistency across the codebase

export const CACHE_KEYS = {
  // User related
  USER_PROFILE: (id: string) => `user:profile:${id}`,
  USER_FOLLOWERS_COUNT: (id: string) => `user:${id}:followers:count`,
  USER_FOLLOWING_COUNT: (id: string) => `user:${id}:following:count`,
  USER_POSTS_COUNT: (id: string) => `user:${id}:posts:count`,
  USER_SETTINGS: (id: string) => `user:${id}:settings`,

  // Content lists
  CATEGORIES_ALL: 'categories:all',
  CATEGORIES_BY_TYPE: (type: string) => `categories:${type}`,

  // Trending content
  TRENDING_POSTS: 'trending:posts',
  TRENDING_HASHTAGS: 'trending:hashtags',
  TRENDING_USERS: 'trending:users',

  // Feed
  USER_FEED: (userId: string, page: number) => `feed:${userId}:page:${page}`,
  GLOBAL_FEED: (page: number) => `feed:global:page:${page}`,

  // Marketplace
  LISTING_VIEWS: (id: string) => `listing:${id}:views`,
  POPULAR_LISTINGS: 'listings:popular',
  LISTINGS_BY_CATEGORY: (categoryId: string) =>
    `listings:category:${categoryId}`,

  // Forum
  FORUM_CATEGORIES: 'forum:categories',
  TOPIC_VIEWS: (id: string) => `forum:topic:${id}:views`,

  // Services
  SERVICES_BY_CATEGORY: (categoryId: string) =>
    `services:category:${categoryId}`,
  SERVICE_RATINGS: (id: string) => `service:${id}:ratings`,

  // Stats
  STATS_USERS_COUNT: 'stats:users:count',
  STATS_POSTS_TODAY: 'stats:posts:today',
  STATS_ACTIVE_USERS: 'stats:active:users',

  // Locks (for cache stampede prevention)
  LOCK: (key: string) => `lock:${key}`,
} as const;

// Cache key patterns for invalidation
export const CACHE_PATTERNS = {
  USER_ALL: (id: string) => `user:${id}:*`,
  USER_PROFILE_ALL: 'user:profile:*',
  FEED_ALL: 'feed:*',
  FEED_USER: (userId: string) => `feed:${userId}:*`,
  TRENDING_ALL: 'trending:*',
  CATEGORIES_ALL: 'categories:*',
  LISTINGS_ALL: 'listings:*',
  FORUM_ALL: 'forum:*',
  SERVICES_ALL: 'services:*',
  STATS_ALL: 'stats:*',
} as const;

// TTL configuration (in seconds)
export const CACHE_TTL = {
  // Short-lived caches (1-5 minutes)
  COUNTS: 60, // 1 minute
  FEED: 60, // 1 minute
  VIEWS: 60, // 1 minute

  // Medium-lived caches (5-15 minutes)
  USER_PROFILE: 300, // 5 minutes
  TRENDING: 300, // 5 minutes
  POPULAR: 300, // 5 minutes
  RATINGS: 300, // 5 minutes

  // Long-lived caches (1 hour+)
  CATEGORIES: 3600, // 1 hour
  SETTINGS: 3600, // 1 hour
  STATS: 300, // 5 minutes

  // Lock TTL
  LOCK: 30, // 30 seconds
} as const;

// Default TTL if not specified
export const DEFAULT_CACHE_TTL = 300; // 5 minutes
