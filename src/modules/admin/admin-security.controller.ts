import {
  Controller,
  Get,
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
import { SecurityService } from '../../common/security/security.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminGuard } from './guards/admin.guard.js';

@ApiTags('admin')
@Controller('admin/security')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class AdminSecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('audit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get security audit report' })
  @ApiResponse({
    status: 200,
    description: 'Security audit report retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getSecurityAudit() {
    const audit = await this.securityService.getSecurityAudit();
    return {
      success: true,
      data: audit,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    };
  }

  @Get('failed-logins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get recent failed login attempts' })
  @ApiResponse({
    status: 200,
    description: 'Failed login attempts retrieved successfully',
  })
  async getFailedLogins() {
    const audit = await this.securityService.getSecurityAudit();
    return {
      success: true,
      data: {
        recentFailedLogins: audit.recentFailedLogins,
        total24h: audit.summary.totalFailedLogins24h,
      },
    };
  }

  @Get('rate-limits')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get rate limit violations' })
  @ApiResponse({
    status: 200,
    description: 'Rate limit violations retrieved successfully',
  })
  async getRateLimitViolations() {
    const audit = await this.securityService.getSecurityAudit();
    return {
      success: true,
      data: {
        rateLimitViolations: audit.rateLimitViolations,
        total24h: audit.summary.totalRateLimitHits24h,
      },
    };
  }

  @Get('suspicious-activity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get suspicious activity report' })
  @ApiResponse({
    status: 200,
    description: 'Suspicious activity report retrieved successfully',
  })
  async getSuspiciousActivity() {
    const audit = await this.securityService.getSecurityAudit();
    return {
      success: true,
      data: {
        suspiciousActivities: audit.suspiciousActivities,
        total24h: audit.summary.totalSuspiciousActivities24h,
        topOffendingIPs: audit.summary.topOffendingIPs,
      },
    };
  }
}
