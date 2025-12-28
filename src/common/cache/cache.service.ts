import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service.js';
import {
  CACHE_TTL,
  DEFAULT_CACHE_TTL,
  CACHE_KEYS,
} from './cache-keys.constant.js';

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memoryUsage: string;
}

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private hits = 0;
  private misses = 0;

  constructor(private readonly redis: RedisService) {}

  onModuleInit(): void {
    this.logger.log('CacheService initialized');
  }

  // Basic operations
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        this.hits++;
        return JSON.parse(value) as T;
      }
      this.misses++;
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.misses++;
      return null;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttl: number = DEFAULT_CACHE_TTL,
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.set(key, serialized, ttl);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async delByPattern(pattern: string): Promise<number> {
    try {
      const client = this.redis.getClient();
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.debug(
          `Deleted ${keys.length} keys matching pattern: ${pattern}`,
        );
        return keys.length;
      }
      return 0;
    } catch (error) {
      this.logger.error(`Cache delete by pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  // Get or set with factory function
  async getOrSet<T>(
    key: string,
    ttl: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Acquire lock to prevent cache stampede
    const lockKey = CACHE_KEYS.LOCK(key);
    const lockAcquired = await this.acquireLock(lockKey, CACHE_TTL.LOCK);

    if (!lockAcquired) {
      // Wait and retry if lock not acquired (another process is computing)
      await this.sleep(100);
      const retryValue = await this.get<T>(key);
      if (retryValue !== null) {
        return retryValue;
      }
      // If still not in cache, compute anyway
    }

    try {
      // Compute the value
      const value = await factory();

      // Store in cache
      await this.set(key, value, ttl);

      return value;
    } finally {
      // Release lock
      if (lockAcquired) {
        await this.releaseLock(lockKey);
      }
    }
  }

  // Stale-while-revalidate pattern
  async getOrSetStale<T>(
    key: string,
    ttl: number,
    staleTtl: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const staleKey = `${key}:stale`;

    // Try to get fresh value
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Try to get stale value
    const stale = await this.get<T>(staleKey);

    // If we have stale data, return it and refresh in background
    if (stale !== null) {
      // Refresh in background (fire and forget)
      this.refreshCache(key, staleKey, ttl, staleTtl, factory).catch((err) => {
        this.logger.error(`Background refresh failed for ${key}:`, err);
      });
      return stale;
    }

    // No cached data, must compute
    return this.refreshCache(key, staleKey, ttl, staleTtl, factory);
  }

  private async refreshCache<T>(
    key: string,
    staleKey: string,
    ttl: number,
    staleTtl: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const lockKey = CACHE_KEYS.LOCK(key);
    const lockAcquired = await this.acquireLock(lockKey, CACHE_TTL.LOCK);

    if (!lockAcquired) {
      // Another process is refreshing, wait for it
      await this.sleep(100);
      const retryValue = await this.get<T>(key);
      if (retryValue !== null) {
        return retryValue;
      }
    }

    try {
      const value = await factory();

      // Set both fresh and stale values
      await Promise.all([
        this.set(key, value, ttl),
        this.set(staleKey, value, staleTtl),
      ]);

      return value;
    } finally {
      if (lockAcquired) {
        await this.releaseLock(lockKey);
      }
    }
  }

  // Counter operations
  async increment(key: string, by = 1): Promise<number> {
    try {
      const client = this.redis.getClient();
      return await client.incrby(key, by);
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  async decrement(key: string, by = 1): Promise<number> {
    try {
      const client = this.redis.getClient();
      return await client.decrby(key, by);
    } catch (error) {
      this.logger.error(`Cache decrement error for key ${key}:`, error);
      return 0;
    }
  }

  // Hash operations
  async setHash(key: string, field: string, value: unknown): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.hset(key, field, serialized);
    } catch (error) {
      this.logger.error(`Cache setHash error for key ${key}:`, error);
    }
  }

  async getHash<T>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      this.logger.error(`Cache getHash error for key ${key}:`, error);
      return null;
    }
  }

  async getAllHash<T = unknown>(key: string): Promise<Record<string, T>> {
    try {
      const hash = await this.redis.hgetall(key);
      const result: Record<string, T> = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value) as T;
        } catch {
          result[field] = value as unknown as T;
        }
      }
      return result;
    } catch (error) {
      this.logger.error(`Cache getAllHash error for key ${key}:`, error);
      return {};
    }
  }

  async delHash(key: string, field: string): Promise<void> {
    try {
      await this.redis.hdel(key, field);
    } catch (error) {
      this.logger.error(`Cache delHash error for key ${key}:`, error);
    }
  }

  // Set operations (for unique collections)
  async addToSet(key: string, ...members: string[]): Promise<number> {
    try {
      const client = this.redis.getClient();
      return await client.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Cache addToSet error for key ${key}:`, error);
      return 0;
    }
  }

  async removeFromSet(key: string, ...members: string[]): Promise<number> {
    try {
      const client = this.redis.getClient();
      return await client.srem(key, ...members);
    } catch (error) {
      this.logger.error(`Cache removeFromSet error for key ${key}:`, error);
      return 0;
    }
  }

  async getSetMembers(key: string): Promise<string[]> {
    try {
      const client = this.redis.getClient();
      return await client.smembers(key);
    } catch (error) {
      this.logger.error(`Cache getSetMembers error for key ${key}:`, error);
      return [];
    }
  }

  async isSetMember(key: string, member: string): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      return (await client.sismember(key, member)) === 1;
    } catch (error) {
      this.logger.error(`Cache isSetMember error for key ${key}:`, error);
      return false;
    }
  }

  // Lock operations for cache stampede prevention
  private async acquireLock(key: string, ttl: number): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const result = await client.set(key, '1', 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Lock acquire error for key ${key}:`, error);
      return false;
    }
  }

  private async releaseLock(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Lock release error for key ${key}:`, error);
    }
  }

  // TTL operations
  async getTtl(key: string): Promise<number> {
    try {
      const client = this.redis.getClient();
      return await client.ttl(key);
    } catch (error) {
      this.logger.error(`Cache getTtl error for key ${key}:`, error);
      return -1;
    }
  }

  async setTtl(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl);
    } catch (error) {
      this.logger.error(`Cache setTtl error for key ${key}:`, error);
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    return this.redis.exists(key);
  }

  // Cache statistics
  async getStats(): Promise<CacheStats> {
    try {
      const client = this.redis.getClient();
      const info = await client.info('memory');
      const dbSize = await client.dbsize();

      // Parse memory usage from info
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

      const total = this.hits + this.misses;
      const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        keys: dbSize,
        memoryUsage,
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: 0,
        keys: 0,
        memoryUsage: 'unknown',
      };
    }
  }

  // Reset statistics
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  // Utility
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Bulk operations
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    try {
      const client = this.redis.getClient();
      const values = await client.mget(...keys);
      return values.map((v) => {
        if (v) {
          this.hits++;
          try {
            return JSON.parse(v) as T;
          } catch {
            return v as unknown as T;
          }
        }
        this.misses++;
        return null;
      });
    } catch (error) {
      this.logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset(
    entries: Array<{ key: string; value: unknown; ttl?: number }>,
  ): Promise<void> {
    try {
      const client = this.redis.getClient();
      const pipeline = client.pipeline();

      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        if (entry.ttl) {
          pipeline.setex(entry.key, entry.ttl, serialized);
        } else {
          pipeline.set(entry.key, serialized);
        }
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Cache mset error:', error);
    }
  }

  // Clear all cache (use with caution)
  async flushAll(): Promise<void> {
    try {
      await this.redis.flushdb();
      this.logger.warn('All cache cleared');
    } catch (error) {
      this.logger.error('Cache flush error:', error);
    }
  }
}
