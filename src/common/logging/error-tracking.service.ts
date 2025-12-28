import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service.js';
import { RedisService } from '../../redis/redis.service.js';

export interface Breadcrumb {
  type: 'http' | 'user' | 'navigation' | 'console' | 'error' | 'info';
  category: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  url?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  breadcrumbs?: Breadcrumb[];
}

export interface TrackedError {
  id: string;
  name: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  fingerprint: string;
  firstSeen: Date;
  lastSeen: Date;
  count: number;
  resolved: boolean;
}

@Injectable()
export class ErrorTrackingService {
  private readonly ERROR_PREFIX = 'errors:tracked';
  private readonly BREADCRUMB_PREFIX = 'errors:breadcrumbs';
  private readonly MAX_BREADCRUMBS = 50;
  private readonly ERROR_RETENTION_DAYS = 30;

  // In-memory breadcrumbs per request (cleared after request)
  private requestBreadcrumbs = new Map<string, Breadcrumb[]>();

  constructor(
    private readonly logger: LoggingService,
    private readonly redis: RedisService,
  ) {
    if (this.logger) {
      this.logger.setContext('ErrorTrackingService');
    }
  }

  // Breadcrumb methods
  addBreadcrumb(
    requestId: string,
    breadcrumb: Omit<Breadcrumb, 'timestamp'>,
  ): void {
    const crumbs = this.requestBreadcrumbs.get(requestId) || [];
    crumbs.push({
      ...breadcrumb,
      timestamp: new Date(),
    });

    // Keep only last N breadcrumbs
    if (crumbs.length > this.MAX_BREADCRUMBS) {
      crumbs.shift();
    }

    this.requestBreadcrumbs.set(requestId, crumbs);
  }

  getBreadcrumbs(requestId: string): Breadcrumb[] {
    return this.requestBreadcrumbs.get(requestId) || [];
  }

  clearBreadcrumbs(requestId: string): void {
    this.requestBreadcrumbs.delete(requestId);
  }

  // Error tracking methods
  async captureException(
    error: Error,
    context: ErrorContext = {},
  ): Promise<string> {
    const errorId = this.generateErrorId();
    const fingerprint = this.generateFingerprint(error);

    // Get breadcrumbs if requestId is available
    const breadcrumbs = context.requestId
      ? this.getBreadcrumbs(context.requestId)
      : [];

    const trackedError: TrackedError = {
      id: errorId,
      name: error.name,
      message: error.message,
      stack: error.stack,
      context: {
        ...this.sanitizeContext(context),
        breadcrumbs,
      },
      fingerprint,
      firstSeen: new Date(),
      lastSeen: new Date(),
      count: 1,
      resolved: false,
    };

    // Log the error
    this.logger.logError(error, {
      requestId: context.requestId,
      userId: context.userId,
      metadata: {
        errorId,
        fingerprint,
        tags: context.tags,
      },
    });

    // Store in Redis
    await this.storeError(trackedError);

    // Clean up breadcrumbs
    if (context.requestId) {
      this.clearBreadcrumbs(context.requestId);
    }

    return errorId;
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context: ErrorContext = {},
  ): void {
    this.logger.log(message, {
      requestId: context.requestId,
      userId: context.userId,
      metadata: {
        level,
        tags: context.tags,
        extra: context.extra,
      },
    });
  }

  // Query methods
  async getError(errorId: string): Promise<TrackedError | null> {
    const data = await this.redis.get(`${this.ERROR_PREFIX}:${errorId}`);
    return data ? (JSON.parse(data) as TrackedError) : null;
  }

  async getErrors(
    options: {
      resolved?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<TrackedError[]> {
    const client = this.redis.getClient();
    const pattern = `${this.ERROR_PREFIX}:*`;
    const keys = await client.keys(pattern);

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const errors: TrackedError[] = [];

    for (const key of keys.slice(offset, offset + limit)) {
      const data = await client.get(key);
      if (data) {
        const error = JSON.parse(data) as TrackedError;
        if (
          options.resolved === undefined ||
          error.resolved === options.resolved
        ) {
          errors.push(error);
        }
      }
    }

    return errors.sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
    );
  }

  async getErrorStats(): Promise<{
    total: number;
    unresolved: number;
    todayCount: number;
    topErrors: Array<{ fingerprint: string; count: number; message: string }>;
  }> {
    const errors = await this.getErrors({ limit: 1000 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayErrors = errors.filter((e) => new Date(e.lastSeen) >= today);

    // Group by fingerprint
    const grouped = new Map<string, { count: number; message: string }>();
    for (const error of errors) {
      const existing = grouped.get(error.fingerprint);
      if (existing) {
        existing.count += error.count;
      } else {
        grouped.set(error.fingerprint, {
          count: error.count,
          message: error.message,
        });
      }
    }

    const topErrors = Array.from(grouped.entries())
      .map(([fingerprint, data]) => ({
        fingerprint,
        count: data.count,
        message: data.message,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: errors.length,
      unresolved: errors.filter((e) => !e.resolved).length,
      todayCount: todayErrors.reduce((sum, e) => sum + e.count, 0),
      topErrors,
    };
  }

  async resolveError(errorId: string): Promise<void> {
    const error = await this.getError(errorId);
    if (error) {
      error.resolved = true;
      await this.storeError(error);
    }
  }

  async unresolveError(errorId: string): Promise<void> {
    const error = await this.getError(errorId);
    if (error) {
      error.resolved = false;
      await this.storeError(error);
    }
  }

  // Private helpers
  private async storeError(error: TrackedError): Promise<void> {
    const key = `${this.ERROR_PREFIX}:${error.id}`;
    const fingerprintKey = `${this.ERROR_PREFIX}:fp:${error.fingerprint}`;

    // Check if we've seen this error before (by fingerprint)
    const existingId = await this.redis.get(fingerprintKey);

    if (existingId) {
      // Update existing error
      const existingData = await this.redis.get(
        `${this.ERROR_PREFIX}:${existingId}`,
      );
      if (existingData) {
        const existing = JSON.parse(existingData) as TrackedError;
        existing.lastSeen = error.lastSeen;
        existing.count++;
        existing.context = error.context; // Update with latest context

        await this.redis.set(
          `${this.ERROR_PREFIX}:${existingId}`,
          JSON.stringify(existing),
          this.ERROR_RETENTION_DAYS * 24 * 60 * 60,
        );
        return;
      }
    }

    // Store new error
    await Promise.all([
      this.redis.set(
        key,
        JSON.stringify(error),
        this.ERROR_RETENTION_DAYS * 24 * 60 * 60,
      ),
      this.redis.set(
        fingerprintKey,
        error.id,
        this.ERROR_RETENTION_DAYS * 24 * 60 * 60,
      ),
    ]);
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateFingerprint(error: Error): string {
    // Create a fingerprint based on error name, message pattern, and stack frames
    const stackLines = error.stack?.split('\n').slice(0, 5) || [];
    const stackFingerprint = stackLines
      .map((line) => line.replace(/:\d+:\d+\)?$/, '')) // Remove line/column numbers
      .join('|');

    const message = error.message
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        'UUID',
      )
      .replace(/\d+/g, 'N'); // Normalize numbers

    return Buffer.from(`${error.name}|${message}|${stackFingerprint}`)
      .toString('base64')
      .substring(0, 32);
  }

  private sanitizeContext(context: ErrorContext): ErrorContext {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
    ];

    const sanitize = (
      obj: Record<string, unknown>,
    ): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
          result[key] = '[REDACTED]';
        } else if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          result[key] = sanitize(value as Record<string, unknown>);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return {
      ...context,
      extra: context.extra ? sanitize(context.extra) : undefined,
    };
  }
}
