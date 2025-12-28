import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SanitizeInterceptor.name);

  // Fields that should allow HTML content (for rich text editors)
  private readonly allowHtmlFields = new Set([
    'htmlContent',
    'richText',
    'description', // Some descriptions might need HTML
  ]);

  // Fields that should never be sanitized (passwords, tokens, etc.)
  private readonly skipFields = new Set([
    'password',
    'passwordHash',
    'token',
    'refreshToken',
    'accessToken',
    'secret',
    'apiKey',
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    // Sanitize body (mutable)
    if (request.body && typeof request.body === 'object') {
      request.body = this.sanitizeObject(
        request.body as Record<string, unknown>,
      );
    }

    // Sanitize query params in place (query object is read-only but its values can be modified)
    if (request.query && typeof request.query === 'object') {
      this.sanitizeInPlace(request.query as Record<string, unknown>);
    }

    // Sanitize route params in place
    if (request.params && typeof request.params === 'object') {
      this.sanitizeInPlace(request.params as Record<string, unknown>);
    }

    return next.handle();
  }

  private sanitizeInPlace(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        obj[key] = this.sanitizeString(value);
      }
    }
  }

  private sanitizeObject(
    obj: Record<string, unknown>,
    path = '',
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;

      if (this.skipFields.has(key)) {
        sanitized[key] = value;
        continue;
      }

      if (typeof value === 'string') {
        sanitized[key] = this.allowHtmlFields.has(key)
          ? this.sanitizeHtml(value)
          : this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item: unknown, index) => {
          if (typeof item === 'string') {
            return this.sanitizeString(item);
          } else if (typeof item === 'object' && item !== null) {
            return this.sanitizeObject(
              item as Record<string, unknown>,
              `${fieldPath}[${index}]`,
            );
          }
          return item as string | number | boolean | null;
        });
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(
          value as Record<string, unknown>,
          fieldPath,
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeString(input: string): string {
    if (!input) return input;

    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Decode HTML entities to prevent double encoding
    sanitized = this.decodeHtmlEntities(sanitized);

    // Escape dangerous characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove potential script injections in URLs
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');

    return sanitized.trim();
  }

  private sanitizeHtml(input: string): string {
    if (!input) return input;

    // For HTML content, we allow basic tags but remove dangerous ones
    const dangerousTags =
      /<(script|iframe|object|embed|form|input|button|link|meta|style)[^>]*>[\s\S]*?<\/\1>|<(script|iframe|object|embed|form|input|button|link|meta|style)[^>]*\/?>/gi;
    let sanitized = input.replace(dangerousTags, '');

    // Remove event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

    // Remove javascript: and data: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    return sanitized.trim();
  }

  private decodeHtmlEntities(input: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#39;': "'",
      '&apos;': "'",
    };

    return input.replace(
      /&(?:amp|lt|gt|quot|#x27|#x2F|#39|apos);/g,
      (match) => entities[match] || match,
    );
  }
}
