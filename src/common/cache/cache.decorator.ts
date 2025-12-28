import { SetMetadata } from '@nestjs/common';
import { DEFAULT_CACHE_TTL } from './cache-keys.constant.js';

// Metadata keys
export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';
export const CACHE_STALE_TTL_METADATA = 'cache:stale:ttl';
export const CACHE_ENABLED_METADATA = 'cache:enabled';

// Interface for cache options
export interface CacheOptions {
  key: string;
  ttl?: number;
  staleTtl?: number;
}

/**
 * Decorator to mark a controller method as cacheable.
 * The key pattern can include placeholders that will be replaced with request params.
 *
 * Example:
 * @CacheRoute('user:profile:{id}', 300)
 * @Get(':id')
 * async getProfile(@Param('id') id: string) { ... }
 *
 * The {id} placeholder will be replaced with the actual id from the route param.
 */
export function CacheRoute(
  key: string,
  ttl: number = DEFAULT_CACHE_TTL,
): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor);
    SetMetadata(CACHE_ENABLED_METADATA, true)(target, propertyKey, descriptor);
    return descriptor;
  };
}

/**
 * Decorator to mark a controller method as cacheable with stale-while-revalidate.
 *
 * Example:
 * @CacheRouteStale('trending:posts', 300, 3600)
 * @Get('trending')
 * async getTrending() { ... }
 *
 * Fresh TTL: 300 seconds (5 minutes)
 * Stale TTL: 3600 seconds (1 hour) - will serve stale data while refreshing in background
 */
export function CacheRouteStale(
  key: string,
  ttl: number = DEFAULT_CACHE_TTL,
  staleTtl: number = DEFAULT_CACHE_TTL * 2,
): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor);
    SetMetadata(CACHE_STALE_TTL_METADATA, staleTtl)(
      target,
      propertyKey,
      descriptor,
    );
    SetMetadata(CACHE_ENABLED_METADATA, true)(target, propertyKey, descriptor);
    return descriptor;
  };
}

/**
 * Decorator to disable caching for a specific route.
 * Useful when you want to disable caching for a specific endpoint in a cached controller.
 */
export function NoCache(): MethodDecorator {
  return SetMetadata(CACHE_ENABLED_METADATA, false);
}

/**
 * Method decorator for service-level caching.
 * This decorator wraps a method to cache its result.
 *
 * The key pattern supports parameter interpolation:
 * - {0}, {1}, etc. - positional parameters
 * - {paramName} - named parameters (if using objects)
 *
 * Example:
 * @Cached('user:profile:{0}', 300)
 * async getUserProfile(userId: string) { ... }
 *
 * @Cached('feed:{userId}:page:{page}', 60)
 * async getFeed(options: { userId: string; page: number }) { ... }
 */
export function Cached(
  keyPattern: string,
  ttl: number = DEFAULT_CACHE_TTL,
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;

    descriptor.value = async function (
      this: {
        cacheService?: {
          getOrSet: <T>(
            key: string,
            ttl: number,
            factory: () => Promise<T>,
          ) => Promise<T>;
        };
      },
      ...args: unknown[]
    ): Promise<unknown> {
      // Build cache key from pattern and arguments
      const cacheKey = buildCacheKey(keyPattern, args);

      // Check if cacheService is available on the instance
      const cacheService = this.cacheService;
      if (!cacheService) {
        // If no cache service, just call the original method
        return originalMethod.apply(this, args);
      }

      // Use getOrSet for cache-aside pattern
      return cacheService.getOrSet(cacheKey, ttl, async () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

/**
 * Method decorator for service-level caching with stale-while-revalidate.
 *
 * Example:
 * @CachedStale('trending:posts', 300, 3600)
 * async getTrendingPosts() { ... }
 */
export function CachedStale(
  keyPattern: string,
  ttl: number = DEFAULT_CACHE_TTL,
  staleTtl: number = DEFAULT_CACHE_TTL * 2,
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;

    descriptor.value = async function (
      this: {
        cacheService?: {
          getOrSetStale: <T>(
            key: string,
            ttl: number,
            staleTtl: number,
            factory: () => Promise<T>,
          ) => Promise<T>;
        };
      },
      ...args: unknown[]
    ): Promise<unknown> {
      const cacheKey = buildCacheKey(keyPattern, args);

      const cacheService = this.cacheService;
      if (!cacheService) {
        return originalMethod.apply(this, args);
      }

      return cacheService.getOrSetStale(cacheKey, ttl, staleTtl, async () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

/**
 * Decorator to invalidate cache after method execution.
 *
 * Example:
 * @InvalidateCache('user:profile:{0}')
 * async updateProfile(userId: string, data: UpdateProfileDto) { ... }
 *
 * @InvalidateCache(['user:profile:{0}', 'user:{0}:*'])
 * async deleteUser(userId: string) { ... }
 */
export function InvalidateCache(patterns: string | string[]): MethodDecorator {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];

  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;

    descriptor.value = async function (
      this: {
        cacheService?: {
          del: (key: string) => Promise<void>;
          delByPattern: (pattern: string) => Promise<number>;
        };
      },
      ...args: unknown[]
    ): Promise<unknown> {
      // Call original method first
      const result = await originalMethod.apply(this, args);

      // Invalidate cache patterns
      const cacheService = this.cacheService;
      if (cacheService) {
        await Promise.all(
          patternArray.map((pattern) => {
            const key = buildCacheKey(pattern, args);
            if (key.includes('*')) {
              return cacheService.delByPattern(key);
            }
            return cacheService.del(key);
          }),
        );
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Build cache key from pattern and method arguments.
 * Supports:
 * - {0}, {1}, etc. for positional arguments
 * - {paramName} for object property access on first argument
 */
function buildCacheKey(pattern: string, args: unknown[]): string {
  return pattern.replace(/\{(\w+)\}/g, (match, key: string) => {
    // Check if it's a numeric index
    const index = parseInt(key, 10);
    if (!isNaN(index)) {
      const value = args[index];
      if (value !== undefined && value !== null) {
        return typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
      }
      return match;
    }

    // Check if first argument is an object with the property
    const firstArg = args[0];
    if (firstArg && typeof firstArg === 'object' && key in firstArg) {
      const value = (
        firstArg as Record<string, string | number | boolean | null | undefined>
      )[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }

    return match;
  });
}

// Export the helper function for use in other places
export { buildCacheKey };
