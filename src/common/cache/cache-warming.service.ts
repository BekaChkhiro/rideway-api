import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from './cache.service.js';

/**
 * Interface for cache warming tasks.
 * Implement this interface to register new cache warming tasks.
 */
export interface CacheWarmingTask {
  name: string;
  warmUp: () => Promise<void>;
  schedule?: string; // Cron expression
}

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);
  private readonly warmingTasks: Map<string, CacheWarmingTask> = new Map();
  private isWarmingInProgress = false;

  constructor(private readonly cacheService: CacheService) {}

  onModuleInit(): void {
    // Warm up cache on startup (with delay to allow services to initialize)
    setTimeout(() => {
      this.warmUpOnStartup().catch((err) => {
        this.logger.error('Startup cache warming failed:', err);
      });
    }, 5000);
  }

  /**
   * Register a cache warming task.
   * Tasks will be executed on startup and can be scheduled.
   */
  registerTask(task: CacheWarmingTask): void {
    this.warmingTasks.set(task.name, task);
    this.logger.log(`Registered cache warming task: ${task.name}`);
  }

  /**
   * Unregister a cache warming task.
   */
  unregisterTask(name: string): void {
    this.warmingTasks.delete(name);
  }

  /**
   * Get all registered tasks.
   */
  getTasks(): string[] {
    return Array.from(this.warmingTasks.keys());
  }

  /**
   * Warm up cache on application startup.
   */
  private async warmUpOnStartup(): Promise<void> {
    if (this.isWarmingInProgress) {
      this.logger.warn('Cache warming already in progress, skipping');
      return;
    }

    this.isWarmingInProgress = true;
    this.logger.log('Starting cache warming on startup...');

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    for (const [name, task] of this.warmingTasks) {
      try {
        await task.warmUp();
        successCount++;
        this.logger.debug(`Cache warmed: ${name}`);
      } catch (error) {
        failCount++;
        this.logger.error(`Failed to warm cache for ${name}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Cache warming completed in ${duration}ms. Success: ${successCount}, Failed: ${failCount}`,
    );

    this.isWarmingInProgress = false;
  }

  /**
   * Warm up all caches manually.
   */
  async warmAll(): Promise<{
    success: number;
    failed: number;
    duration: number;
  }> {
    if (this.isWarmingInProgress) {
      throw new Error('Cache warming already in progress');
    }

    this.isWarmingInProgress = true;
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    for (const [name, task] of this.warmingTasks) {
      try {
        await task.warmUp();
        successCount++;
      } catch (error) {
        failCount++;
        this.logger.error(`Failed to warm cache for ${name}:`, error);
      }
    }

    this.isWarmingInProgress = false;

    return {
      success: successCount,
      failed: failCount,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Warm a specific cache by task name.
   */
  async warmTask(name: string): Promise<void> {
    const task = this.warmingTasks.get(name);
    if (!task) {
      throw new Error(`Cache warming task not found: ${name}`);
    }

    await task.warmUp();
    this.logger.log(`Cache warmed: ${name}`);
  }

  // Scheduled warming tasks

  /**
   * Warm trending caches every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async warmTrendingCaches(): Promise<void> {
    this.logger.debug('Warming trending caches...');

    try {
      // Warm trending posts
      const trendingPostsTask = this.warmingTasks.get('trending:posts');
      if (trendingPostsTask) {
        await trendingPostsTask.warmUp();
      }

      // Warm trending hashtags
      const trendingHashtagsTask = this.warmingTasks.get('trending:hashtags');
      if (trendingHashtagsTask) {
        await trendingHashtagsTask.warmUp();
      }
    } catch (error) {
      this.logger.error('Failed to warm trending caches:', error);
    }
  }

  /**
   * Warm categories every hour.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async warmCategories(): Promise<void> {
    this.logger.debug('Warming category caches...');

    try {
      const categoriesTask = this.warmingTasks.get('categories');
      if (categoriesTask) {
        await categoriesTask.warmUp();
      }
    } catch (error) {
      this.logger.error('Failed to warm category caches:', error);
    }
  }

  /**
   * Warm popular content every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async warmPopularContent(): Promise<void> {
    this.logger.debug('Warming popular content caches...');

    try {
      const popularTask = this.warmingTasks.get('popular:listings');
      if (popularTask) {
        await popularTask.warmUp();
      }
    } catch (error) {
      this.logger.error('Failed to warm popular content caches:', error);
    }
  }

  /**
   * Warm stats every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async warmStats(): Promise<void> {
    this.logger.debug('Warming stats caches...');

    try {
      const statsTask = this.warmingTasks.get('stats');
      if (statsTask) {
        await statsTask.warmUp();
      }
    } catch (error) {
      this.logger.error('Failed to warm stats caches:', error);
    }
  }

  /**
   * Check warming status.
   */
  isWarming(): boolean {
    return this.isWarmingInProgress;
  }
}

/**
 * Mixin to easily add cache warming capabilities to services.
 */
export abstract class CacheWarmable {
  protected abstract readonly cacheService: CacheService;
  protected abstract readonly cacheWarmingService: CacheWarmingService;
  protected abstract readonly warmingTaskName: string;

  protected registerCacheWarming(): void {
    this.cacheWarmingService.registerTask({
      name: this.warmingTaskName,
      warmUp: () => this.warmCache(),
    });
  }

  protected abstract warmCache(): Promise<void>;
}
