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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = this.getErrorResponse(exception);
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

  private getErrorResponse(exception: unknown): {
    message: string;
    details?: unknown[];
  } {
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
              : 'An error occurred';

        const details = Array.isArray(messageValue) ? messageValue : undefined;

        return { message, details };
      }
    }

    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment && exception instanceof Error) {
      return {
        message: exception.message,
        details: [exception.stack],
      };
    }

    return { message: 'Internal server error' };
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
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';

    const errorMessage =
      exception instanceof Error ? exception.message : 'Unknown error';

    const logMessage = `${method} ${url} ${status} - ${ip} - ${userAgent} - ${errorMessage}`;

    if (status >= 500) {
      this.logger.error(
        logMessage,
        exception instanceof Error ? exception.stack : '',
      );
    } else if (status >= 400) {
      this.logger.warn(logMessage);
    }
  }
}
