import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface.js';

interface AuthenticatedUser {
  id?: string;
  email?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  // Patterns to redact from logs
  private readonly sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /authorization/i,
    /cookie/i,
    /api[_-]?key/i,
    /credential/i,
  ];

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.getHttpStatus(exception);
    const errorResponse = this.getErrorResponse(exception, status);
    const errorCode = this.getErrorCode(status);

    const apiResponse: ApiResponse<null> = {
      success: false,
      error: {
        code: errorCode,
        message: errorResponse.message,
        details: errorResponse.details,
      },
    };

    this.logError(request, status, exception);

    response.status(status).json(apiResponse);
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    // Handle TypeORM errors
    if (this.isTypeORMError(exception)) {
      return HttpStatus.BAD_REQUEST;
    }

    // Handle validation errors
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
    if (this.isDevelopment && exception instanceof Error) {
      return {
        message: exception.message,
        details: exception.stack ? [exception.stack] : undefined,
      };
    }

    // In production, return generic messages for security
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

  private logError(request: Request, status: number, exception: unknown): void {
    const { method, url } = request;
    const userAgent = request.get('user-agent') || '';
    const user = request.user as AuthenticatedUser | undefined;

    const errorMessage =
      exception instanceof Error ? exception.message : 'Unknown error';
    const sanitizedBody = this.redactSensitiveData(
      request.body as Record<string, unknown>,
    );

    const logContext = {
      method,
      url,
      status,
      ip: this.getClientIp(request),
      userAgent,
      userId: user?.id,
      body: this.isDevelopment ? sanitizedBody : undefined,
      timestamp: new Date().toISOString(),
    };

    const logMessage = `${method} ${url} ${status} - ${errorMessage}`;

    if (status >= 500) {
      this.logger.error(logMessage, {
        ...logContext,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else if (status >= 400) {
      this.logger.warn(logMessage, logContext);
    }
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

  private redactSensitiveData(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const isSensitive = this.sensitivePatterns.some((pattern) =>
        pattern.test(key),
      );

      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveData(
          value as Record<string, unknown>,
        );
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
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
}
