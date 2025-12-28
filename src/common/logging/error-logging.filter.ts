import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggingService } from './logging.service.js';
import { ApiResponse } from '../interfaces/api-response.interface.js';

interface AuthenticatedUser {
  id?: string;
  email?: string;
}

interface RequestWithId extends Request {
  requestId?: string;
}

@Catch()
export class ErrorLoggingFilter implements ExceptionFilter {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(private readonly logger: LoggingService) {
    if (this.logger) {
      this.logger.setContext('ExceptionFilter');
    }
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const status = this.getHttpStatus(exception);
    const errorResponse = this.getErrorResponse(exception, status);
    const errorCode = this.getErrorCode(status);

    const { method, url } = request;
    const user = request.user as AuthenticatedUser | undefined;
    const requestId = request.requestId;

    // Build API response
    const apiResponse: ApiResponse<null> = {
      success: false,
      error: {
        code: errorCode,
        message: errorResponse.message,
        details: errorResponse.details,
      },
    };

    // Add requestId to response for debugging
    if (requestId && !this.isProduction) {
      (apiResponse as Record<string, unknown>).requestId = requestId;
    }

    // Log the error with full context
    const logContext = {
      requestId,
      userId: user?.id,
      method,
      url,
      ip: this.getClientIp(request),
      statusCode: status,
      metadata: {
        errorCode,
        userAgent: request.get('user-agent'),
        body: this.sanitizeBody(request.body as Record<string, unknown>),
        query: request.query,
        params: request.params,
      },
    };

    if (status >= 500) {
      // Server errors - log full stack trace
      const error =
        exception instanceof Error ? exception : new Error(String(exception));
      this.logger.logError(error, logContext);

      // Also log security event for potential attacks
      if (this.isSecurityRelated(error)) {
        this.logger.logSecurity('Potential Attack', this.getClientIp(request), {
          error: error.message,
          method,
          url,
          requestId,
        });
      }
    } else if (status >= 400) {
      // Client errors - log as warning
      this.logger.warn(`Client Error: ${errorResponse.message}`, logContext);

      // Log repeated authentication failures
      if (status === 401 || status === 403) {
        this.logger.logSecurity('Auth Failure', this.getClientIp(request), {
          status,
          message: errorResponse.message,
          userId: user?.id,
          requestId,
        });
      }
    }

    response.status(status).json(apiResponse);
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    // Handle specific error types
    if (this.isTypeORMError(exception)) {
      return HttpStatus.BAD_REQUEST;
    }

    if (this.isValidationError(exception)) {
      return HttpStatus.UNPROCESSABLE_ENTITY;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorResponse(
    exception: unknown,
    status: number,
  ): { message: string; details?: unknown[] } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { message: response };
      }

      if (typeof response === 'object' && response !== null) {
        const responseObj = response as Record<string, unknown>;
        const messageValue = responseObj.message;
        const message =
          typeof messageValue === 'string'
            ? messageValue
            : Array.isArray(messageValue)
              ? String(messageValue[0])
              : this.getDefaultMessage(status);

        const details = Array.isArray(messageValue) ? messageValue : undefined;

        return { message, details };
      }
    }

    // In development, show more error details
    if (!this.isProduction && exception instanceof Error) {
      return {
        message: exception.message,
        details: exception.stack ? [exception.stack] : undefined,
      };
    }

    // In production, return generic messages
    return { message: this.getDefaultMessage(status) };
  }

  private getDefaultMessage(status: number): string {
    const messages: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Access denied',
      [HttpStatus.NOT_FOUND]: 'Resource not found',
      [HttpStatus.CONFLICT]: 'Resource conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Validation failed',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred',
    };

    return messages[status] || 'An error occurred';
  }

  private getErrorCode(status: number): string {
    const errorCodes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
    };

    return errorCodes[status] || 'UNKNOWN_ERROR';
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

  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
      'creditCard',
      'cvv',
      'ssn',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      const isSensitive = sensitiveKeys.some((sk) =>
        key.toLowerCase().includes(sk.toLowerCase()),
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeBody(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isTypeORMError(exception: unknown): boolean {
    if (exception && typeof exception === 'object') {
      const name = (exception as { name?: string }).name;
      return name?.includes('TypeORM') || name?.includes('Query') || false;
    }
    return false;
  }

  private isValidationError(exception: unknown): boolean {
    if (exception && typeof exception === 'object') {
      const name = (exception as { name?: string }).name;
      return name === 'ValidationError' || name === 'BadRequestException';
    }
    return false;
  }

  private isSecurityRelated(error: Error): boolean {
    const securityPatterns = [
      /sql\s*injection/i,
      /xss/i,
      /script\s*injection/i,
      /unauthorized/i,
      /forbidden/i,
      /invalid\s*token/i,
      /malformed/i,
    ];

    return securityPatterns.some((pattern) => pattern.test(error.message));
  }
}
