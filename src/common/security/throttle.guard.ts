import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0] || req.ip || 'unknown';
    return ip;
  }

  protected throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: {
      limit: number;
      ttl: number;
      key: string;
      tracker: string;
      totalHits: number;
      timeToExpire: number;
      isBlocked: boolean;
      timeToBlockExpire: number;
    },
  ): void {
    const request = context.switchToHttp().getRequest<Request>();
    const endpoint = request.url;

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please try again later.',
        error: 'Too Many Requests',
        retryAfter: Math.ceil(throttlerLimitDetail.timeToExpire / 1000),
        endpoint,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0] || req.ip || 'unknown';

    // Also track by email if present in body
    const email = (req.body as { email?: string })?.email;
    if (email) {
      return `${ip}:${email}`;
    }
    return ip;
  }

  protected throwThrottlingException(
    _context: ExecutionContext,
    throttlerLimitDetail: {
      limit: number;
      ttl: number;
      key: string;
      tracker: string;
      totalHits: number;
      timeToExpire: number;
      isBlocked: boolean;
      timeToBlockExpire: number;
    },
  ): void {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message:
          'Too many authentication attempts. Please try again in 15 minutes.',
        error: 'Too Many Requests',
        retryAfter: Math.ceil(throttlerLimitDetail.timeToExpire / 1000),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class UploadThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0] || req.ip || 'unknown';

    // Include user ID if authenticated
    const user = req.user as { id?: string } | undefined;
    if (user?.id) {
      return `upload:${user.id}`;
    }
    return `upload:${ip}`;
  }

  protected throwThrottlingException(): void {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many uploads. Please try again in a minute.',
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class SearchThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0] || req.ip || 'unknown';
    return `search:${ip}`;
  }

  protected throwThrottlingException(): void {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many search requests. Please slow down.',
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
