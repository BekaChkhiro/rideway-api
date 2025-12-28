import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService, CacheStats } from './cache.service.js';

export interface CacheAlert {
  type: 'LOW_HIT_RATE' | 'HIGH_MEMORY' | 'HIGH_KEY_COUNT' | 'SLOW_OPERATIONS';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface CacheHealthStatus {
  healthy: boolean;
  stats: CacheStats;
  alerts: CacheAlert[];
  lastCheck: Date;
}

@Injectable()
export class CacheMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(CacheMonitoringService.name);
  private alerts: CacheAlert[] = [];
  private lastStats: CacheStats | null = null;
  private lastCheck: Date = new Date();

  // Thresholds for alerts
  private readonly thresholds = {
    minHitRate: 50, // Minimum hit rate percentage
    maxMemoryMB: 500, // Maximum memory usage in MB
    maxKeys: 100000, // Maximum number of keys
    maxAlerts: 100, // Maximum alerts to keep in memory
  };

  constructor(private readonly cacheService: CacheService) {}

  async onModuleInit(): Promise<void> {
    // Initial stats collection
    await this.collectStats();
    this.logger.log('CacheMonitoringService initialized');
  }

  /**
   * Collect and analyze cache statistics.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectStats(): Promise<void> {
    try {
      if (!this.cacheService) {
        this.logger.warn('CacheService not available yet');
        return;
      }

      const stats = await this.cacheService.getStats();
      this.lastStats = stats;
      this.lastCheck = new Date();

      // Analyze and create alerts
      this.analyzeStats(stats);

      this.logger.debug(
        `Cache stats: hits=${stats.hits}, misses=${stats.misses}, hitRate=${stats.hitRate}%, keys=${stats.keys}, memory=${stats.memoryUsage}`,
      );
    } catch (error) {
      this.logger.error('Failed to collect cache stats:', error);
    }
  }

  /**
   * Analyze stats and generate alerts.
   */
  private analyzeStats(stats: CacheStats): void {
    // Check hit rate
    if (
      stats.hitRate < this.thresholds.minHitRate &&
      stats.hits + stats.misses > 100
    ) {
      this.addAlert({
        type: 'LOW_HIT_RATE',
        message: `Cache hit rate is below threshold: ${stats.hitRate}% < ${this.thresholds.minHitRate}%`,
        value: stats.hitRate,
        threshold: this.thresholds.minHitRate,
        timestamp: new Date(),
      });
    }

    // Check memory usage
    const memoryMB = this.parseMemoryUsage(stats.memoryUsage);
    if (memoryMB > this.thresholds.maxMemoryMB) {
      this.addAlert({
        type: 'HIGH_MEMORY',
        message: `Cache memory usage is high: ${stats.memoryUsage} > ${this.thresholds.maxMemoryMB}MB`,
        value: memoryMB,
        threshold: this.thresholds.maxMemoryMB,
        timestamp: new Date(),
      });
    }

    // Check key count
    if (stats.keys > this.thresholds.maxKeys) {
      this.addAlert({
        type: 'HIGH_KEY_COUNT',
        message: `Cache has too many keys: ${stats.keys} > ${this.thresholds.maxKeys}`,
        value: stats.keys,
        threshold: this.thresholds.maxKeys,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Parse memory usage string to MB.
   */
  private parseMemoryUsage(usage: string): number {
    const match = usage.match(/([\d.]+)([KMGT]?)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2]?.toUpperCase() || '';

    switch (unit) {
      case 'K':
        return value / 1024;
      case 'M':
        return value;
      case 'G':
        return value * 1024;
      case 'T':
        return value * 1024 * 1024;
      default:
        return value / (1024 * 1024); // Assume bytes
    }
  }

  /**
   * Add an alert.
   */
  private addAlert(alert: CacheAlert): void {
    this.alerts.push(alert);

    // Keep only last N alerts
    if (this.alerts.length > this.thresholds.maxAlerts) {
      this.alerts = this.alerts.slice(-this.thresholds.maxAlerts);
    }

    // Log the alert
    this.logger.warn(`Cache Alert [${alert.type}]: ${alert.message}`);
  }

  /**
   * Get current health status.
   */
  async getHealthStatus(): Promise<CacheHealthStatus> {
    const stats =
      this.lastStats ||
      (this.cacheService ? await this.cacheService.getStats() : null);

    const recentAlerts = this.alerts.filter(
      (a) => Date.now() - a.timestamp.getTime() < 60 * 60 * 1000, // Last hour
    );

    const defaultStats: CacheStats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      keys: 0,
      memoryUsage: '0B',
    };

    return {
      healthy: recentAlerts.length === 0,
      stats: stats || defaultStats,
      alerts: recentAlerts,
      lastCheck: this.lastCheck,
    };
  }

  /**
   * Get all alerts.
   */
  getAlerts(limit = 50): CacheAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clear all alerts.
   */
  clearAlerts(): void {
    this.alerts = [];
    this.logger.log('Cache alerts cleared');
  }

  /**
   * Get current statistics.
   */
  getStats(): CacheStats | null {
    return this.lastStats;
  }

  /**
   * Update thresholds.
   */
  setThresholds(thresholds: Partial<typeof this.thresholds>): void {
    Object.assign(this.thresholds, thresholds);
    this.logger.log('Cache monitoring thresholds updated:', this.thresholds);
  }

  /**
   * Get current thresholds.
   */
  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  /**
   * Reset cache statistics.
   */
  resetStats(): void {
    if (this.cacheService) {
      this.cacheService.resetStats();
    }
    this.lastStats = null;
    this.logger.log('Cache statistics reset');
  }

  /**
   * Log periodic report.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async logHourlyReport(): Promise<void> {
    const status = await this.getHealthStatus();

    this.logger.log('===== Cache Hourly Report =====');
    this.logger.log(`Hit Rate: ${status.stats.hitRate}%`);
    this.logger.log(`Total Hits: ${status.stats.hits}`);
    this.logger.log(`Total Misses: ${status.stats.misses}`);
    this.logger.log(`Keys: ${status.stats.keys}`);
    this.logger.log(`Memory: ${status.stats.memoryUsage}`);
    this.logger.log(`Alerts (last hour): ${status.alerts.length}`);
    this.logger.log(`Health: ${status.healthy ? 'HEALTHY' : 'DEGRADED'}`);
    this.logger.log('================================');

    // Reset stats for next hour
    if (this.cacheService) {
      this.cacheService.resetStats();
    }
  }
}
