import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { LoggingService } from './logging.service.js';

interface AuthenticatedUser {
  id?: string;
  email?: string;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggingService) {
    if (this.logger) {
      this.logger.setContext('HTTP');
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate unique request ID
    const requestId =
      (request.headers['x-request-id'] as string) || randomUUID();

    // Attach request ID to request and response
    (request as Request & { requestId: string }).requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    const { method, url } = request;
    const userAgent = request.get('user-agent') || '';
    const user = request.user as AuthenticatedUser | undefined;
    const userId = user?.id;

    const startTime = Date.now();

    // Log incoming request
    this.logger.logRequest(method, url, {
      requestId,
      userId,
      ip: this.getClientIp(request),
      userAgent,
      metadata: {
        query: this.sanitizeQuery(request.query),
        contentLength: request.headers['content-length'],
      },
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Log successful response
          this.logger.logResponse(method, url, statusCode, duration, {
            requestId,
            userId,
            ip: this.getClientIp(request),
          });

          // Log slow requests
          if (duration > 1000) {
            this.logger.logPerformance('Slow Request', duration, {
              requestId,
              method,
              url,
              metadata: { threshold: 1000 },
            });
          }
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 500;

          // Log error response
          this.logger.logResponse(method, url, statusCode, duration, {
            requestId,
            userId,
            ip: this.getClientIp(request),
            metadata: {
              error: error.name,
              message: error.message,
            },
          });

          // Log full error
          this.logger.logError(error, {
            requestId,
            userId,
            method,
            url,
          });
        },
      }),
    );
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || 'unknown';
  }

  private sanitizeQuery(query: Request['query']): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sensitiveParams = ['password', 'token', 'key', 'secret'];

    for (const [key, value] of Object.entries(query)) {
      if (sensitiveParams.some((p) => key.toLowerCase().includes(p))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Lightweight version of request logging that only logs basic info.
 * Use this for high-traffic endpoints where full logging is too expensive.
 */
@Injectable()
export class LightRequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggingService) {
    if (this.logger) {
      this.logger.setContext('HTTP');
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          // Only log slow requests
          if (duration > 500) {
            this.logger.debug(
              `${request.method} ${request.url} ${response.statusCode} ${duration}ms`,
            );
          }
        },
        error: (error: Error) => {
          this.logger.error(
            `${request.method} ${request.url} ${error.message}`,
            error.stack,
          );
        },
      }),
    );
  }
}
