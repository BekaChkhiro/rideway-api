import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestValidationMiddleware.name);

  private readonly allowedContentTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ];

  private readonly maxBodySize = 10 * 1024 * 1024; // 10MB default

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip validation for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Validate Content-Type for requests with body
    if (
      req.headers['content-length'] &&
      parseInt(req.headers['content-length'], 10) > 0
    ) {
      const contentType = req.headers['content-type'];

      if (!contentType) {
        throw new HttpException(
          {
            statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            message: 'Content-Type header is required',
            error: 'Unsupported Media Type',
          },
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        );
      }

      // Check if content type is allowed
      const isAllowed = this.allowedContentTypes.some((allowed) =>
        contentType.toLowerCase().includes(allowed),
      );

      if (!isAllowed) {
        this.logger.warn(
          `Rejected request with unsupported Content-Type: ${contentType}`,
          {
            ip: this.getClientIp(req),
            url: req.url,
            method: req.method,
          },
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            message: `Content-Type '${contentType}' is not supported`,
            error: 'Unsupported Media Type',
          },
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        );
      }
    }

    // Validate body size
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > this.maxBodySize) {
      this.logger.warn(
        `Rejected request with body size ${contentLength} bytes`,
        {
          ip: this.getClientIp(req),
          url: req.url,
          method: req.method,
        },
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: 'Request body too large',
          error: 'Payload Too Large',
          maxSize: this.maxBodySize,
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // Validate JSON content
    if (req.headers['content-type']?.includes('application/json') && req.body) {
      try {
        // If body is already parsed, it's valid JSON
        if (typeof req.body === 'string') {
          JSON.parse(req.body);
        }
      } catch {
        this.logger.warn('Rejected request with malformed JSON', {
          ip: this.getClientIp(req),
          url: req.url,
          method: req.method,
        });

        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Malformed JSON in request body',
            error: 'Bad Request',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    next();
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || 'unknown';
  }
}
