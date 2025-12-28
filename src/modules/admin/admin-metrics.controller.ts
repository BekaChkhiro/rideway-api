import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MetricsService } from '../../common/logging/metrics.service.js';
import { PerformanceService } from '../../common/logging/performance.service.js';
import { ErrorTrackingService } from '../../common/logging/error-tracking.service.js';
import { AuditService } from '../../common/logging/audit.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminGuard } from './guards/admin.guard.js';

@ApiTags('admin')
@Controller('admin/metrics')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class AdminMetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly performanceService: PerformanceService,
    private readonly errorTrackingService: ErrorTrackingService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getAllMetrics() {
    const metrics = await this.metricsService.getAllMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get request metrics' })
  @ApiResponse({
    status: 200,
    description: 'Request metrics retrieved successfully',
  })
  getRequestMetrics() {
    const metrics = this.metricsService.getRequestMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('endpoints')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get endpoint metrics' })
  @ApiResponse({
    status: 200,
    description: 'Endpoint metrics retrieved successfully',
  })
  async getEndpointMetrics() {
    const metrics = await this.metricsService.getEndpointMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('system')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiResponse({
    status: 200,
    description: 'System metrics retrieved successfully',
  })
  getSystemMetrics() {
    const metrics = this.metricsService.getSystemMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get performance stats' })
  @ApiResponse({
    status: 200,
    description: 'Performance stats retrieved successfully',
  })
  getPerformanceStats() {
    const stats = this.performanceService.getStats();
    return {
      success: true,
      data: {
        ...stats,
        memory: this.performanceService.getMemoryUsage(),
        eventLoopLag: this.performanceService.getAverageEventLoopLag(),
      },
    };
  }

  @Get('performance/slow-queries')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get slow database queries' })
  @ApiResponse({
    status: 200,
    description: 'Slow queries retrieved successfully',
  })
  getSlowQueries() {
    const queries = this.performanceService.getSlowQueries();
    return {
      success: true,
      data: queries,
    };
  }

  @Get('performance/slow-requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get slow HTTP requests' })
  @ApiResponse({
    status: 200,
    description: 'Slow requests retrieved successfully',
  })
  getSlowRequests() {
    const requests = this.performanceService.getSlowRequests();
    return {
      success: true,
      data: requests,
    };
  }

  @Get('errors')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get error tracking stats' })
  @ApiResponse({
    status: 200,
    description: 'Error stats retrieved successfully',
  })
  async getErrorStats() {
    const stats = await this.errorTrackingService.getErrorStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('errors/list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get tracked errors list' })
  @ApiResponse({
    status: 200,
    description: 'Errors list retrieved successfully',
  })
  async getErrors() {
    const errors = await this.errorTrackingService.getErrors({ limit: 50 });
    return {
      success: true,
      data: errors,
    };
  }

  @Get('audit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  async getAuditLogs() {
    const logs = await this.auditService.getAuditLogs({ limit: 100 });
    return {
      success: true,
      data: logs,
    };
  }

  @Get('audit/security')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get security-related audit logs' })
  @ApiResponse({
    status: 200,
    description: 'Security audit logs retrieved successfully',
  })
  async getSecurityAuditLogs() {
    const logs = await this.auditService.getSecurityAuditLogs();
    return {
      success: true,
      data: logs,
    };
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset metrics counters' })
  @ApiResponse({ status: 200, description: 'Metrics reset successfully' })
  resetMetrics() {
    this.metricsService.resetHourlyMetrics();
    return {
      success: true,
      message: 'Metrics have been reset',
    };
  }
}
