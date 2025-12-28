import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service.js';
import { RedisService } from '../../redis/redis.service.js';

export enum AuditAction {
  // Authentication
  USER_REGISTER = 'USER_REGISTER',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE = 'PASSWORD_RESET_COMPLETE',
  TOKEN_REFRESH = 'TOKEN_REFRESH',

  // Profile
  PROFILE_CREATE = 'PROFILE_CREATE',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  PROFILE_DELETE = 'PROFILE_DELETE',
  AVATAR_CHANGE = 'AVATAR_CHANGE',
  EMAIL_VERIFY = 'EMAIL_VERIFY',
  PHONE_VERIFY = 'PHONE_VERIFY',

  // Social
  USER_FOLLOW = 'USER_FOLLOW',
  USER_UNFOLLOW = 'USER_UNFOLLOW',
  USER_BLOCK = 'USER_BLOCK',
  USER_UNBLOCK = 'USER_UNBLOCK',

  // Content
  POST_CREATE = 'POST_CREATE',
  POST_UPDATE = 'POST_UPDATE',
  POST_DELETE = 'POST_DELETE',
  COMMENT_CREATE = 'COMMENT_CREATE',
  COMMENT_DELETE = 'COMMENT_DELETE',
  CONTENT_REPORT = 'CONTENT_REPORT',

  // Marketplace
  LISTING_CREATE = 'LISTING_CREATE',
  LISTING_UPDATE = 'LISTING_UPDATE',
  LISTING_DELETE = 'LISTING_DELETE',
  LISTING_SOLD = 'LISTING_SOLD',

  // Admin
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_ACTION = 'ADMIN_ACTION',
  USER_BAN = 'USER_BAN',
  USER_UNBAN = 'USER_UNBAN',
  CONTENT_REMOVE = 'CONTENT_REMOVE',
  SETTING_CHANGE = 'SETTING_CHANGE',

  // Security
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  userId: string;
  targetId?: string;
  targetType?: string;
  ip: string;
  userAgent?: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
export class AuditService {
  private readonly AUDIT_LOG_PREFIX = 'audit:log';
  private readonly AUDIT_RETENTION_DAYS = 90;

  constructor(
    private readonly logger: LoggingService,
    private readonly redis: RedisService,
  ) {
    if (this.logger) {
      this.logger.setContext('AuditService');
    }
  }

  async log(
    action: AuditAction,
    userId: string,
    details: {
      targetId?: string;
      targetType?: string;
      ip: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const entry: AuditEntry = {
      id: this.generateId(),
      action,
      userId,
      targetId: details.targetId,
      targetType: details.targetType,
      ip: details.ip,
      userAgent: details.userAgent,
      details: details.metadata || {},
      timestamp: new Date(),
    };

    // Log to Winston
    this.logger.logAudit(action, userId, {
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    });

    // Store in Redis for quick access
    await this.storeAuditEntry(entry);
  }

  // Convenience methods for common actions
  async logRegistration(
    userId: string,
    email: string,
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log(AuditAction.USER_REGISTER, userId, {
      ip,
      userAgent,
      metadata: { email },
    });
  }

  async logLogin(
    userId: string,
    ip: string,
    userAgent?: string,
    method?: string,
  ): Promise<void> {
    await this.log(AuditAction.USER_LOGIN, userId, {
      ip,
      userAgent,
      metadata: { method: method || 'email' },
    });
  }

  async logLoginFailed(
    email: string,
    ip: string,
    reason: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log(AuditAction.USER_LOGIN_FAILED, 'unknown', {
      ip,
      userAgent,
      metadata: { email, reason },
    });
  }

  async logLogout(
    userId: string,
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log(AuditAction.USER_LOGOUT, userId, {
      ip,
      userAgent,
    });
  }

  async logPasswordChange(
    userId: string,
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log(AuditAction.PASSWORD_CHANGE, userId, {
      ip,
      userAgent,
    });
  }

  async logProfileUpdate(
    userId: string,
    changes: string[],
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log(AuditAction.PROFILE_UPDATE, userId, {
      ip,
      userAgent,
      metadata: { changedFields: changes },
    });
  }

  async logAdminAction(
    adminId: string,
    action: string,
    targetId: string,
    targetType: string,
    ip: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(AuditAction.ADMIN_ACTION, adminId, {
      targetId,
      targetType,
      ip,
      metadata: { action, ...details },
    });
  }

  async logSecurityEvent(
    action: AuditAction,
    ip: string,
    details: Record<string, unknown>,
    userId?: string,
  ): Promise<void> {
    await this.log(action, userId || 'anonymous', {
      ip,
      metadata: details,
    });
  }

  // Query methods
  async getAuditLogs(options: {
    userId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditEntry[]> {
    const client = this.redis.getClient();
    const key = this.getAuditKey(options.userId);
    const limit = options.limit || 100;

    const entries = await client.lrange(key, 0, limit - 1);

    return entries
      .map((e) => JSON.parse(e) as AuditEntry)
      .filter((entry) => {
        if (options.action && entry.action !== options.action) return false;
        if (options.startDate && new Date(entry.timestamp) < options.startDate)
          return false;
        if (options.endDate && new Date(entry.timestamp) > options.endDate)
          return false;
        return true;
      });
  }

  async getUserAuditLogs(userId: string, limit = 50): Promise<AuditEntry[]> {
    return this.getAuditLogs({ userId, limit });
  }

  async getSecurityAuditLogs(limit = 100): Promise<AuditEntry[]> {
    const securityActions = [
      AuditAction.USER_LOGIN_FAILED,
      AuditAction.SUSPICIOUS_ACTIVITY,
      AuditAction.RATE_LIMIT_EXCEEDED,
      AuditAction.INVALID_TOKEN,
      AuditAction.USER_BAN,
    ];

    const allLogs = await this.getAuditLogs({ limit: limit * 2 });

    return allLogs
      .filter((log) => securityActions.includes(log.action))
      .slice(0, limit);
  }

  // Private helpers
  private async storeAuditEntry(entry: AuditEntry): Promise<void> {
    const client = this.redis.getClient();

    // Store in global audit log
    const globalKey = `${this.AUDIT_LOG_PREFIX}:all`;
    await client.lpush(globalKey, JSON.stringify(entry));
    await client.ltrim(globalKey, 0, 9999); // Keep last 10000 entries
    await client.expire(globalKey, this.AUDIT_RETENTION_DAYS * 24 * 60 * 60);

    // Store in user-specific log
    if (
      entry.userId &&
      entry.userId !== 'unknown' &&
      entry.userId !== 'anonymous'
    ) {
      const userKey = `${this.AUDIT_LOG_PREFIX}:user:${entry.userId}`;
      await client.lpush(userKey, JSON.stringify(entry));
      await client.ltrim(userKey, 0, 999); // Keep last 1000 entries per user
      await client.expire(userKey, this.AUDIT_RETENTION_DAYS * 24 * 60 * 60);
    }

    // Store in action-specific log
    const actionKey = `${this.AUDIT_LOG_PREFIX}:action:${entry.action.toLowerCase()}`;
    await client.lpush(actionKey, JSON.stringify(entry));
    await client.ltrim(actionKey, 0, 999);
    await client.expire(actionKey, this.AUDIT_RETENTION_DAYS * 24 * 60 * 60);
  }

  private getAuditKey(userId?: string): string {
    if (userId) {
      return `${this.AUDIT_LOG_PREFIX}:user:${userId}`;
    }
    return `${this.AUDIT_LOG_PREFIX}:all`;
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
