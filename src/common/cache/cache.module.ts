import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheService } from './cache.service.js';
import { CacheWarmingService } from './cache-warming.service.js';
import { CacheMonitoringService } from './cache-monitoring.service.js';
import { CacheInterceptor, AutoCacheInterceptor } from './cache.interceptor.js';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    CacheService,
    CacheWarmingService,
    CacheMonitoringService,
    CacheInterceptor,
    AutoCacheInterceptor,
  ],
  exports: [
    CacheService,
    CacheWarmingService,
    CacheMonitoringService,
    CacheInterceptor,
    AutoCacheInterceptor,
  ],
})
export class CacheModule {}
