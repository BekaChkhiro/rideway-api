import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service.js';

export interface SecurityEvent {
  type:
    | 'AUTH_ATTEMPT'
    | 'AUTH_SUCCESS'
    | 'AUTH_FAILURE'
    | 'PASSWORD_CHANGE'
    | 'RATE_LIMIT_HIT'
    | 'SUSPICIOUS_ACTIVITY';
  userId?: string;
  ip: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly SECURITY_LOG_PREFIX = 'security:log';
  private readonly FAILED_ATTEMPTS_PREFIX = 'security:failed';
  private readonly RATE_LIMIT_PREFIX = 'security:ratelimit';
  private readonly LOG_RETENTION_SECONDS = 7 * 24 * 60 * 60; // 7 days

  constructor(private readonly redis: RedisService) {}

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const eventWithTimestamp = {
      ...event,
      timestamp: event.timestamp.toISOString(),
    };

    const key = `${this.SECURITY_LOG_PREFIX}:${event.type.toLowerCase()}`;
    const eventJson = JSON.stringify(eventWithTimestamp);
    const client = this.redis.getClient();

    try {
      await client.lpush(key, eventJson);
      await client.ltrim(key, 0, 999); // Keep last 1000 events per type
      await client.expire(key, this.LOG_RETENTION_SECONDS);

      if (
        event.type === 'AUTH_FAILURE' ||
        event.type === 'SUSPICIOUS_ACTIVITY'
      ) {
        this.logger.warn(`Security Event: ${event.type}`, eventWithTimestamp);
      } else {
        this.logger.log(`Security Event: ${event.type}`, eventWithTimestamp);
      }
    } catch (error) {
      this.logger.error('Failed to log security event', error);
    }
  }

  async logAuthAttempt(
    ip: string,
    email: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logSecurityEvent({
      type: 'AUTH_ATTEMPT',
      ip,
      userAgent,
      details: { email },
      timestamp: new Date(),
    });
  }

  async logAuthSuccess(
    userId: string,
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    await this.clearFailedAttempts(ip);
    await this.logSecurityEvent({
      type: 'AUTH_SUCCESS',
      userId,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  }

  async logAuthFailure(
    ip: string,
    email: string,
    reason: string,
    userAgent?: string,
  ): Promise<void> {
    await this.incrementFailedAttempts(ip);
    await this.logSecurityEvent({
      type: 'AUTH_FAILURE',
      ip,
      userAgent,
      details: { email, reason },
      timestamp: new Date(),
    });
  }

  async logPasswordChange(
    userId: string,
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logSecurityEvent({
      type: 'PASSWORD_CHANGE',
      userId,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  }

  async logRateLimitHit(
    ip: string,
    endpoint: string,
    userAgent?: string,
  ): Promise<void> {
    const client = this.redis.getClient();
    const key = `${this.RATE_LIMIT_PREFIX}:${ip}`;
    await client.incr(key);
    await client.expire(key, 3600); // 1 hour

    await this.logSecurityEvent({
      type: 'RATE_LIMIT_HIT',
      ip,
      endpoint,
      userAgent,
      timestamp: new Date(),
    });
  }

  async logSuspiciousActivity(
    ip: string,
    description: string,
    details?: Record<string, unknown>,
    userAgent?: string,
  ): Promise<void> {
    await this.logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      ip,
      userAgent,
      details: { description, ...details },
      timestamp: new Date(),
    });
  }

  private async incrementFailedAttempts(ip: string): Promise<number> {
    const client = this.redis.getClient();
    const key = `${this.FAILED_ATTEMPTS_PREFIX}:${ip}`;
    const count = await client.incr(key);
    await client.expire(key, 900); // 15 minutes
    return count;
  }

  private async clearFailedAttempts(ip: string): Promise<void> {
    const key = `${this.FAILED_ATTEMPTS_PREFIX}:${ip}`;
    await this.redis.del(key);
  }

  async getFailedAttempts(ip: string): Promise<number> {
    const key = `${this.FAILED_ATTEMPTS_PREFIX}:${ip}`;
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async isBlocked(ip: string, maxAttempts = 5): Promise<boolean> {
    const attempts = await this.getFailedAttempts(ip);
    return attempts >= maxAttempts;
  }

  async getSecurityAudit(): Promise<{
    recentFailedLogins: SecurityEvent[];
    rateLimitViolations: SecurityEvent[];
    suspiciousActivities: SecurityEvent[];
    summary: {
      totalFailedLogins24h: number;
      totalRateLimitHits24h: number;
      totalSuspiciousActivities24h: number;
      topOffendingIPs: { ip: string; count: number }[];
    };
  }> {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;

    const [failedLogins, rateLimits, suspicious] = await Promise.all([
      this.getSecurityEvents('auth_failure', 50),
      this.getSecurityEvents('rate_limit_hit', 50),
      this.getSecurityEvents('suspicious_activity', 50),
    ]);

    const filter24h = (events: SecurityEvent[]) =>
      events.filter((e) => new Date(e.timestamp).getTime() > last24h);

    const failedLogins24h = filter24h(failedLogins);
    const rateLimits24h = filter24h(rateLimits);
    const suspicious24h = filter24h(suspicious);

    const ipCounts = new Map<string, number>();
    [...failedLogins24h, ...rateLimits24h, ...suspicious24h].forEach(
      (event) => {
        ipCounts.set(event.ip, (ipCounts.get(event.ip) || 0) + 1);
      },
    );

    const topOffendingIPs = Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      recentFailedLogins: failedLogins.slice(0, 20),
      rateLimitViolations: rateLimits.slice(0, 20),
      suspiciousActivities: suspicious.slice(0, 20),
      summary: {
        totalFailedLogins24h: failedLogins24h.length,
        totalRateLimitHits24h: rateLimits24h.length,
        totalSuspiciousActivities24h: suspicious24h.length,
        topOffendingIPs,
      },
    };
  }

  private async getSecurityEvents(
    type: string,
    limit: number,
  ): Promise<SecurityEvent[]> {
    const client = this.redis.getClient();
    const key = `${this.SECURITY_LOG_PREFIX}:${type}`;
    const events = await client.lrange(key, 0, limit - 1);
    return events.map((e) => JSON.parse(e) as SecurityEvent);
  }
}
