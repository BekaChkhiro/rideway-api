import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class FileValidationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const file = request.file as Express.Multer.File | undefined;
    const files = request.files as Express.Multer.File[] | undefined;

    if (file) {
      this.validateFile(file);
    }

    if (files && Array.isArray(files)) {
      for (const f of files) {
        this.validateFile(f);
      }
    }

    return next.handle();
  }

  private validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File ${file.originalname} exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Check mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File ${file.originalname} has invalid type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Sanitize filename - remove path traversal attempts
    if (file.originalname.includes('..') || file.originalname.includes('/')) {
      throw new BadRequestException('Invalid filename');
    }
  }
}
