import { Module } from '@nestjs/common';
import { AdminSecurityController } from './admin-security.controller.js';
import { AdminCacheController } from './admin-cache.controller.js';
import { AdminMetricsController } from './admin-metrics.controller.js';
import { AdminGuard } from './guards/admin.guard.js';

@Module({
  controllers: [
    AdminSecurityController,
    AdminCacheController,
    AdminMetricsController,
  ],
  providers: [AdminGuard],
  exports: [AdminGuard],
})
export class AdminModule {}
