import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from '../../redis/redis.health.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(TypeOrmHealthIndicator) private readonly db: TypeOrmHealthIndicator,
    @Inject(RedisHealthIndicator) private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('db')
  @HealthCheck()
  checkDatabase() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('redis')
  @HealthCheck()
  checkRedis() {
    return this.health.check([() => this.redis.isHealthy('redis')]);
  }
}
