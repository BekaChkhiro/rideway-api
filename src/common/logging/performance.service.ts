import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggingService } from './logging.service.js';
import { RedisService } from '../../redis/redis.service.js';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface SlowQueryLog {
  query: string;
  duration: number;
  timestamp: Date;
  parameters?: unknown[];
}

export interface PerformanceStats {
  slowQueries: number;
  slowRequests: number;
  avgEventLoopLag: number;
  memoryWarnings: number;
  lastHour: {
    slowQueries: SlowQueryLog[];
    slowRequests: PerformanceMetric[];
  };
}

@Injectable()
export class PerformanceService implements OnModuleInit, OnModuleDestroy {
  private readonly PERF_PREFIX = 'performance';
  private readonly SLOW_QUERY_THRESHOLD = 100; // ms
  private readonly SLOW_REQUEST_THRESHOLD = 1000; // ms
  private readonly MEMORY_WARNING_THRESHOLD = 500; // MB
  private readonly EVENT_LOOP_WARNING_THRESHOLD = 100; // ms

  private slowQueries: SlowQueryLog[] = [];
  private slowRequests: PerformanceMetric[] = [];
  private eventLoopLags: number[] = [];
  private memoryWarnings = 0;
  private eventLoopMonitorInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: LoggingService,
    private readonly redis: RedisService,
  ) {
    if (this.logger) {
      this.logger.setContext('PerformanceService');
    }
  }

  onModuleInit(): void {
    this.startEventLoopMonitoring();
    if (this.logger) {
      this.logger.log('PerformanceService initialized');
    }
  }

  onModuleDestroy(): void {
    if (this.eventLoopMonitorInterval) {
      clearInterval(this.eventLoopMonitorInterval);
    }
  }

  // Track slow queries
  trackQuery(query: string, duration: number, parameters?: unknown[]): void {
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      const log: SlowQueryLog = {
        query: this.sanitizeQuery(query),
        duration,
        timestamp: new Date(),
        parameters: this.sanitizeParameters(parameters),
      };

      this.slowQueries.push(log);

      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries = this.slowQueries.slice(-100);
      }

      this.logger.logPerformance('Slow Query', duration, {
        metadata: {
          query: log.query.substring(0, 200),
          threshold: this.SLOW_QUERY_THRESHOLD,
        },
      });
    }
  }

  // Track slow requests
  trackRequest(
    method: string,
    url: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (duration > this.SLOW_REQUEST_THRESHOLD) {
      const metric: PerformanceMetric = {
        name: `${method} ${url}`,
        duration,
        timestamp: new Date(),
        metadata,
      };

      this.slowRequests.push(metric);

      // Keep only last 100 slow requests
      if (this.slowRequests.length > 100) {
        this.slowRequests = this.slowRequests.slice(-100);
      }

      this.logger.logPerformance('Slow Request', duration, {
        method,
        url,
        metadata: {
          ...metadata,
          threshold: this.SLOW_REQUEST_THRESHOLD,
        },
      });
    }
  }

  // Track custom operation
  trackOperation(
    name: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (duration > 500) {
      this.logger.logPerformance(`Slow Operation: ${name}`, duration, {
        metadata,
      });
    }
  }

  // Memory monitoring
  checkMemoryUsage(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);

    if (heapUsedMB > this.MEMORY_WARNING_THRESHOLD) {
      this.memoryWarnings++;
      this.logger.warn(`High memory usage: ${heapUsedMB}MB`, {
        metadata: {
          heapUsed: heapUsedMB,
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
          rss: Math.round(usage.rss / 1024 / 1024),
          external: Math.round(usage.external / 1024 / 1024),
          threshold: this.MEMORY_WARNING_THRESHOLD,
        },
      });

      // Suggest garbage collection in extreme cases
      if (heapUsedMB > this.MEMORY_WARNING_THRESHOLD * 1.5) {
        this.logger.error(
          `Critical memory usage: ${heapUsedMB}MB - consider restarting`,
        );
      }
    }
  }

  // Event loop monitoring
  private startEventLoopMonitoring(): void {
    const checkInterval = 1000; // 1 second
    let lastCheck = Date.now();

    this.eventLoopMonitorInterval = setInterval(() => {
      const now = Date.now();
      const lag = now - lastCheck - checkInterval;
      lastCheck = now;

      this.eventLoopLags.push(lag);

      // Keep only last 60 measurements (1 minute)
      if (this.eventLoopLags.length > 60) {
        this.eventLoopLags.shift();
      }

      if (lag > this.EVENT_LOOP_WARNING_THRESHOLD && this.logger) {
        this.logger.warn(`High event loop lag: ${lag.toFixed(2)}ms`, {
          metadata: {
            lag,
            threshold: this.EVENT_LOOP_WARNING_THRESHOLD,
            avgLag: this.getAverageEventLoopLag(),
          },
        });
      }
    }, checkInterval);
  }

  // Get statistics
  getStats(): PerformanceStats {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    return {
      slowQueries: this.slowQueries.length,
      slowRequests: this.slowRequests.length,
      avgEventLoopLag: this.getAverageEventLoopLag(),
      memoryWarnings: this.memoryWarnings,
      lastHour: {
        slowQueries: this.slowQueries.filter(
          (q) => q.timestamp.getTime() > hourAgo,
        ),
        slowRequests: this.slowRequests.filter(
          (r) => r.timestamp.getTime() > hourAgo,
        ),
      },
    };
  }

  getSlowQueries(limit = 20): SlowQueryLog[] {
    return this.slowQueries.slice(-limit).reverse();
  }

  getSlowRequests(limit = 20): PerformanceMetric[] {
    return this.slowRequests.slice(-limit).reverse();
  }

  getAverageEventLoopLag(): number {
    if (this.eventLoopLags.length === 0) return 0;
    const sum = this.eventLoopLags.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.eventLoopLags.length) * 100) / 100;
  }

  getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  } {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
    };
  }

  // Periodic tasks
  @Cron(CronExpression.EVERY_5_MINUTES)
  periodicMemoryCheck(): void {
    if (!this.logger) return;
    this.checkMemoryUsage();
  }

  @Cron(CronExpression.EVERY_HOUR)
  logHourlySummary(): void {
    if (!this.logger) return;

    const stats = this.getStats();
    const memory = this.getMemoryUsage();

    this.logger.info('Performance hourly summary', {
      metadata: {
        slowQueries: stats.lastHour.slowQueries.length,
        slowRequests: stats.lastHour.slowRequests.length,
        avgEventLoopLag: `${stats.avgEventLoopLag}ms`,
        memoryWarnings: this.memoryWarnings,
        currentMemory: `${memory.heapUsed}MB`,
      },
    });

    // Reset hourly counters
    this.memoryWarnings = 0;
  }

  // Helpers
  private sanitizeQuery(query: string): string {
    // Remove actual values from query for logging
    return query
      .replace(/'[^']*'/g, "'?'")
      .replace(/\d+/g, '?')
      .substring(0, 500);
  }

  private sanitizeParameters(params?: unknown[]): unknown[] | undefined {
    if (!params) return undefined;

    return params.map((param) => {
      if (typeof param === 'string' && param.length > 100) {
        return `[string: ${param.length} chars]`;
      }
      if (typeof param === 'object') {
        return '[object]';
      }
      return param;
    });
  }

  // Timer utility for manual performance tracking
  startTimer(): () => number {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1_000_000; // Convert to ms
    };
  }
}

// Decorator for automatic method timing
export function TrackPerformance(operationName?: string): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;
    const name =
      operationName || `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = async function (
      this: { performanceService?: PerformanceService },
      ...args: unknown[]
    ): Promise<unknown> {
      const start = process.hrtime.bigint();

      try {
        return await originalMethod.apply(this, args);
      } finally {
        const duration = Number(process.hrtime.bigint() - start) / 1_000_000;

        if (this.performanceService) {
          this.performanceService.trackOperation(name, duration);
        }
      }
    };

    return descriptor;
  };
}
