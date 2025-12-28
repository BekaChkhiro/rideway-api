import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggingService } from './logging.service.js';
import { RedisService } from '../../redis/redis.service.js';

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeConnections: number;
  requestsPerSecond: number;
}

export interface EndpointMetrics {
  path: string;
  method: string;
  totalRequests: number;
  avgResponseTime: number;
  errorRate: number;
}

export interface SystemMetrics {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  uptime: number;
  eventLoopLag: number;
  cpuUsage: NodeJS.CpuUsage;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly METRICS_PREFIX = 'metrics';
  private readonly METRICS_TTL = 3600; // 1 hour

  private responseTimes: number[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private activeConnections = 0;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCheckTime: number = Date.now();
  private eventLoopLag = 0;

  constructor(
    private readonly logger: LoggingService,
    private readonly redis: RedisService,
  ) {
    if (this.logger) {
      this.logger.setContext('MetricsService');
    }
  }

  onModuleInit(): void {
    // Start event loop lag monitoring
    this.startEventLoopMonitoring();
    if (this.logger) {
      this.logger.log('MetricsService initialized');
    }
  }

  // Record metrics
  recordRequest(duration: number, success: boolean): void {
    this.requestCount++;
    this.responseTimes.push(duration);

    if (!success) {
      this.errorCount++;
    }

    // Keep only last 10000 response times to prevent memory issues
    if (this.responseTimes.length > 10000) {
      this.responseTimes = this.responseTimes.slice(-10000);
    }
  }

  recordEndpointMetrics(
    method: string,
    path: string,
    duration: number,
    statusCode: number,
  ): void {
    const key = `${this.METRICS_PREFIX}:endpoint:${method}:${path.replace(/\//g, ':')}`;
    const isError = statusCode >= 400;

    // Fire and forget - don't block the request
    this.updateEndpointMetrics(key, duration, isError).catch((err: Error) => {
      this.logger.warn(`Failed to record endpoint metrics: ${err.message}`);
    });
  }

  private async updateEndpointMetrics(
    key: string,
    duration: number,
    isError: boolean,
  ): Promise<void> {
    const client = this.redis.getClient();

    await Promise.all([
      client.hincrby(key, 'total', 1),
      client.hincrbyfloat(key, 'totalDuration', duration),
      isError ? client.hincrby(key, 'errors', 1) : Promise.resolve(),
      client.expire(key, this.METRICS_TTL),
    ]);
  }

  incrementConnections(): void {
    this.activeConnections++;
  }

  decrementConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  // Get metrics
  getRequestMetrics(): RequestMetrics {
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const total = sorted.length;

    return {
      totalRequests: this.requestCount,
      successfulRequests: this.requestCount - this.errorCount,
      failedRequests: this.errorCount,
      errorRate:
        this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      avgResponseTime:
        total > 0 ? sorted.reduce((a, b) => a + b, 0) / total : 0,
      p50ResponseTime: this.getPercentile(sorted, 50),
      p95ResponseTime: this.getPercentile(sorted, 95),
      p99ResponseTime: this.getPercentile(sorted, 99),
      activeConnections: this.activeConnections,
      requestsPerSecond: this.calculateRps(),
    };
  }

  async getEndpointMetrics(limit = 20): Promise<EndpointMetrics[]> {
    const client = this.redis.getClient();
    const pattern = `${this.METRICS_PREFIX}:endpoint:*`;
    const keys = await client.keys(pattern);

    const metrics: EndpointMetrics[] = [];

    for (const key of keys.slice(0, limit)) {
      const data = await client.hgetall(key);
      if (data && data.total) {
        const parts = key.split(':');
        const method = parts[2] || 'GET';
        const path = parts.slice(3).join('/');

        const total = parseInt(data.total, 10);
        const totalDuration = parseFloat(data.totalDuration || '0');
        const errors = parseInt(data.errors || '0', 10);

        metrics.push({
          method,
          path: `/${path}`,
          totalRequests: total,
          avgResponseTime: total > 0 ? totalDuration / total : 0,
          errorRate: total > 0 ? (errors / total) * 100 : 0,
        });
      }
    }

    return metrics.sort((a, b) => b.totalRequests - a.totalRequests);
  }

  getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
    this.lastCpuUsage = process.cpuUsage();

    return {
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
      eventLoopLag: this.eventLoopLag,
      cpuUsage,
    };
  }

  async getAllMetrics(): Promise<{
    request: RequestMetrics;
    system: SystemMetrics;
    endpoints: EndpointMetrics[];
    timestamp: string;
  }> {
    return {
      request: this.getRequestMetrics(),
      system: this.getSystemMetrics(),
      endpoints: await this.getEndpointMetrics(),
      timestamp: new Date().toISOString(),
    };
  }

  // Periodic tasks
  @Cron(CronExpression.EVERY_MINUTE)
  logMetrics(): void {
    if (!this.logger) return;

    const metrics = this.getRequestMetrics();
    const system = this.getSystemMetrics();

    this.logger.info('Metrics snapshot', {
      metadata: {
        requests: {
          total: metrics.totalRequests,
          errors: metrics.failedRequests,
          errorRate: `${metrics.errorRate.toFixed(2)}%`,
          avgTime: `${metrics.avgResponseTime.toFixed(2)}ms`,
          p95Time: `${metrics.p95ResponseTime.toFixed(2)}ms`,
        },
        system: {
          heapUsed: `${system.memoryUsage.heapUsed}MB`,
          uptime: `${Math.round(system.uptime / 60)}min`,
          eventLoopLag: `${system.eventLoopLag.toFixed(2)}ms`,
        },
      },
    });

    // Alert on high error rate
    if (metrics.errorRate > 10 && metrics.totalRequests > 100) {
      this.logger.warn(
        `High error rate detected: ${metrics.errorRate.toFixed(2)}%`,
      );
    }

    // Alert on slow response times
    if (metrics.p95ResponseTime > 1000) {
      this.logger.warn(
        `Slow p95 response time: ${metrics.p95ResponseTime.toFixed(2)}ms`,
      );
    }

    // Alert on high memory usage
    if (system.memoryUsage.heapUsed > 500) {
      this.logger.warn(`High memory usage: ${system.memoryUsage.heapUsed}MB`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  resetHourlyMetrics(): void {
    if (!this.logger) return;

    const metrics = this.getRequestMetrics();

    // Log hourly summary
    this.logger.info('Hourly metrics summary', {
      metadata: {
        totalRequests: metrics.totalRequests,
        errorRate: `${metrics.errorRate.toFixed(2)}%`,
        avgResponseTime: `${metrics.avgResponseTime.toFixed(2)}ms`,
        p99ResponseTime: `${metrics.p99ResponseTime.toFixed(2)}ms`,
      },
    });

    // Reset counters
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
  }

  // Private helpers
  private getPercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateRps(): number {
    const now = Date.now();
    const elapsed = (now - this.lastCheckTime) / 1000;
    const rps = elapsed > 0 ? this.requestCount / elapsed : 0;
    return Math.round(rps * 100) / 100;
  }

  private startEventLoopMonitoring(): void {
    const interval = 1000; // Check every second
    let lastCheck = Date.now();

    const check = (): void => {
      const now = Date.now();
      this.eventLoopLag = now - lastCheck - interval;
      lastCheck = now;

      // Alert on high event loop lag
      if (this.eventLoopLag > 100 && this.logger) {
        this.logger.warn(
          `High event loop lag: ${this.eventLoopLag.toFixed(2)}ms`,
        );
      }

      setTimeout(check, interval);
    };

    setTimeout(check, interval);
  }
}
