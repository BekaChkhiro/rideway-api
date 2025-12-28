import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from '../../redis/redis.health.js';
import { MetricsService } from '../../common/logging/metrics.service.js';
import { PerformanceService } from '../../common/logging/performance.service.js';
import { CacheService } from '../../common/cache/cache.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(TypeOrmHealthIndicator) private readonly db: TypeOrmHealthIndicator,
    @Inject(RedisHealthIndicator) private readonly redis: RedisHealthIndicator,
    @Inject(MemoryHealthIndicator)
    private readonly memory: MemoryHealthIndicator,
    @Inject(DiskHealthIndicator) private readonly disk: DiskHealthIndicator,
    private readonly metricsService: MetricsService,
    private readonly performanceService: PerformanceService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Overall health check' })
  @ApiResponse({ status: 200, description: 'Health check passed' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024), // 500MB
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe - checks if all dependencies are available',
  })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service not ready' })
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe - checks if application is running',
  })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    };
  }

  @Get('db')
  @HealthCheck()
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  checkDatabase() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Redis health check' })
  @ApiResponse({ status: 200, description: 'Redis is healthy' })
  @ApiResponse({ status: 503, description: 'Redis is unhealthy' })
  checkRedis() {
    return this.health.check([() => this.redis.isHealthy('redis')]);
  }

  @Get('memory')
  @HealthCheck()
  @ApiOperation({ summary: 'Memory health check' })
  @ApiResponse({ status: 200, description: 'Memory usage is healthy' })
  @ApiResponse({ status: 503, description: 'Memory usage is too high' })
  checkMemory() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024), // 500MB
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024), // 1GB
    ]);
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health status with metrics' })
  @ApiResponse({ status: 200, description: 'Detailed health status' })
  async detailedHealth() {
    const [
      healthStatus,
      cacheStats,
      requestMetrics,
      performanceStats,
      memoryUsage,
    ] = await Promise.all([
      this.health.check([
        () => this.db.pingCheck('database'),
        () => this.redis.isHealthy('redis'),
      ]),
      this.cacheService.getStats(),
      Promise.resolve(this.metricsService.getRequestMetrics()),
      Promise.resolve(this.performanceService.getStats()),
      Promise.resolve(this.performanceService.getMemoryUsage()),
    ]);

    return {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      health: healthStatus,
      cache: {
        hitRate: `${cacheStats.hitRate}%`,
        keys: cacheStats.keys,
        memoryUsage: cacheStats.memoryUsage,
      },
      requests: {
        total: requestMetrics.totalRequests,
        errorRate: `${requestMetrics.errorRate.toFixed(2)}%`,
        avgResponseTime: `${requestMetrics.avgResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${requestMetrics.p95ResponseTime.toFixed(2)}ms`,
        requestsPerSecond: requestMetrics.requestsPerSecond,
      },
      performance: {
        slowQueries: performanceStats.slowQueries,
        slowRequests: performanceStats.slowRequests,
        avgEventLoopLag: `${performanceStats.avgEventLoopLag}ms`,
      },
      memory: {
        heapUsed: `${memoryUsage.heapUsed}MB`,
        heapTotal: `${memoryUsage.heapTotal}MB`,
        rss: `${memoryUsage.rss}MB`,
      },
    };
  }
}
