import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
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
import { CacheService } from '../../common/cache/cache.service.js';
import { CacheWarmingService } from '../../common/cache/cache-warming.service.js';
import { CacheMonitoringService } from '../../common/cache/cache-monitoring.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminGuard } from './guards/admin.guard.js';

@ApiTags('admin')
@Controller('admin/cache')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class AdminCacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheWarmingService: CacheWarmingService,
    private readonly cacheMonitoringService: CacheMonitoringService,
  ) {}

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get cache statistics' })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
  })
  async getStats() {
    const stats = await this.cacheService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get cache health status' })
  @ApiResponse({
    status: 200,
    description: 'Cache health status retrieved successfully',
  })
  async getHealthStatus() {
    const health = await this.cacheMonitoringService.getHealthStatus();
    return {
      success: true,
      data: health,
    };
  }

  @Get('alerts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get cache alerts' })
  @ApiResponse({
    status: 200,
    description: 'Cache alerts retrieved successfully',
  })
  getAlerts() {
    const alerts = this.cacheMonitoringService.getAlerts();
    return {
      success: true,
      data: {
        alerts,
        count: alerts.length,
      },
    };
  }

  @Delete('alerts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear cache alerts' })
  @ApiResponse({
    status: 200,
    description: 'Cache alerts cleared successfully',
  })
  clearAlerts() {
    this.cacheMonitoringService.clearAlerts();
    return {
      success: true,
      message: 'Alerts cleared',
    };
  }

  @Get('warming/tasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get registered cache warming tasks' })
  @ApiResponse({
    status: 200,
    description: 'Warming tasks retrieved successfully',
  })
  getWarmingTasks() {
    const tasks = this.cacheWarmingService.getTasks();
    return {
      success: true,
      data: {
        tasks,
        isWarming: this.cacheWarmingService.isWarming(),
      },
    };
  }

  @Post('warming/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run all cache warming tasks' })
  @ApiResponse({ status: 200, description: 'Cache warming completed' })
  async runWarming() {
    const result = await this.cacheWarmingService.warmAll();
    return {
      success: true,
      data: result,
    };
  }

  @Post('warming/run/:taskName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run specific cache warming task' })
  @ApiResponse({ status: 200, description: 'Cache warming task completed' })
  async runWarmingTask(@Param('taskName') taskName: string) {
    await this.cacheWarmingService.warmTask(taskName);
    return {
      success: true,
      message: `Warming task '${taskName}' completed`,
    };
  }

  @Delete('key/:key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a specific cache key' })
  @ApiResponse({ status: 200, description: 'Cache key deleted successfully' })
  async deleteKey(@Param('key') key: string) {
    await this.cacheService.del(key);
    return {
      success: true,
      message: `Key '${key}' deleted`,
    };
  }

  @Delete('pattern/:pattern')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete cache keys by pattern' })
  @ApiResponse({ status: 200, description: 'Cache keys deleted successfully' })
  async deleteByPattern(@Param('pattern') pattern: string) {
    const count = await this.cacheService.delByPattern(pattern);
    return {
      success: true,
      message: `Deleted ${count} keys matching pattern '${pattern}'`,
      data: { deletedCount: count },
    };
  }

  @Post('flush')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flush all cache (use with caution)' })
  @ApiResponse({ status: 200, description: 'Cache flushed successfully' })
  async flushAll() {
    await this.cacheService.flushAll();
    return {
      success: true,
      message: 'All cache flushed',
    };
  }

  @Post('stats/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset cache statistics' })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics reset successfully',
  })
  resetStats() {
    this.cacheMonitoringService.resetStats();
    return {
      success: true,
      message: 'Statistics reset',
    };
  }

  @Get('thresholds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get monitoring thresholds' })
  @ApiResponse({
    status: 200,
    description: 'Thresholds retrieved successfully',
  })
  getThresholds() {
    const thresholds = this.cacheMonitoringService.getThresholds();
    return {
      success: true,
      data: thresholds,
    };
  }

  @Post('thresholds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update monitoring thresholds' })
  @ApiResponse({ status: 200, description: 'Thresholds updated successfully' })
  setThresholds(
    @Body()
    body: {
      minHitRate?: number;
      maxMemoryMB?: number;
      maxKeys?: number;
    },
  ) {
    this.cacheMonitoringService.setThresholds(body);
    return {
      success: true,
      message: 'Thresholds updated',
      data: this.cacheMonitoringService.getThresholds(),
    };
  }
}
