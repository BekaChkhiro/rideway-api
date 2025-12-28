import { Global, Module } from '@nestjs/common';
import { LoggingService } from './logging.service.js';
import { AuditService } from './audit.service.js';
import { MetricsService } from './metrics.service.js';
import { ErrorTrackingService } from './error-tracking.service.js';
import { PerformanceService } from './performance.service.js';
import {
  RequestLoggingInterceptor,
  LightRequestLoggingInterceptor,
} from './request-logging.interceptor.js';
import { ErrorLoggingFilter } from './error-logging.filter.js';

@Global()
@Module({
  providers: [
    LoggingService,
    AuditService,
    MetricsService,
    ErrorTrackingService,
    PerformanceService,
    RequestLoggingInterceptor,
    LightRequestLoggingInterceptor,
    ErrorLoggingFilter,
  ],
  exports: [
    LoggingService,
    AuditService,
    MetricsService,
    ErrorTrackingService,
    PerformanceService,
    RequestLoggingInterceptor,
    LightRequestLoggingInterceptor,
    ErrorLoggingFilter,
  ],
})
export class LoggingModule {}
