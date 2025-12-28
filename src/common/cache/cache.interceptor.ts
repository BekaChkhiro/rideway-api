import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CacheService } from './cache.service.js';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CACHE_STALE_TTL_METADATA,
  CACHE_ENABLED_METADATA,
} from './cache.decorator.js';
import { DEFAULT_CACHE_TTL } from './cache-keys.constant.js';

interface CachedResponse<T> {
  data: T;
  cachedAt: string;
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    // Check if caching is enabled for this route
    const isEnabled = this.reflector.get<boolean>(
      CACHE_ENABLED_METADATA,
      context.getHandler(),
    );

    if (isEnabled === false) {
      return next.handle();
    }

    // Get cache key pattern from metadata
    const keyPattern = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );

    if (!keyPattern) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Build cache key from pattern
    const cacheKey = this.buildCacheKey(keyPattern, request);
    const ttl =
      this.reflector.get<number>(CACHE_TTL_METADATA, context.getHandler()) ||
      DEFAULT_CACHE_TTL;
    const staleTtl = this.reflector.get<number>(
      CACHE_STALE_TTL_METADATA,
      context.getHandler(),
    );

    try {
      // Try to get from cache
      const cachedResponse =
        await this.cacheService.get<CachedResponse<unknown>>(cacheKey);

      if (cachedResponse) {
        // Set cache headers
        this.setCacheHeaders(response, ttl, true, cachedResponse.cachedAt);

        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return of(cachedResponse.data);
      }

      // If using stale-while-revalidate, check for stale data
      if (staleTtl) {
        const staleKey = `${cacheKey}:stale`;
        const staleResponse =
          await this.cacheService.get<CachedResponse<unknown>>(staleKey);

        if (staleResponse) {
          // Return stale data and refresh in background
          this.setCacheHeaders(
            response,
            ttl,
            true,
            staleResponse.cachedAt,
            true,
          );

          // Refresh in background
          next
            .handle()
            .pipe(
              tap((data) => {
                const newCached: CachedResponse<unknown> = {
                  data,
                  cachedAt: new Date().toISOString(),
                };
                void Promise.all([
                  this.cacheService.set(cacheKey, newCached, ttl),
                  this.cacheService.set(staleKey, newCached, staleTtl),
                ]);
              }),
            )
            .subscribe();

          this.logger.debug(`Cache STALE: ${cacheKey}`);
          return of(staleResponse.data);
        }
      }

      this.logger.debug(`Cache MISS: ${cacheKey}`);

      // Cache miss - execute handler and cache result
      return next.handle().pipe(
        tap((data) => {
          const cachedData: CachedResponse<unknown> = {
            data,
            cachedAt: new Date().toISOString(),
          };

          if (staleTtl) {
            const staleKey = `${cacheKey}:stale`;
            void Promise.all([
              this.cacheService.set(cacheKey, cachedData, ttl),
              this.cacheService.set(staleKey, cachedData, staleTtl),
            ]);
          } else {
            void this.cacheService.set(cacheKey, cachedData, ttl);
          }

          this.setCacheHeaders(response, ttl, false);
        }),
      );
    } catch (error) {
      this.logger.error(`Cache error for ${cacheKey}:`, error);
      return next.handle();
    }
  }

  private buildCacheKey(pattern: string, request: Request): string {
    let key = pattern;

    // Replace route params
    if (request.params) {
      for (const [param, value] of Object.entries(request.params)) {
        key = key.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
      }
    }

    // Replace query params
    if (request.query) {
      for (const [param, value] of Object.entries(request.query)) {
        const strValue =
          typeof value === 'string' ? value : JSON.stringify(value);
        key = key.replace(new RegExp(`\\{${param}\\}`, 'g'), strValue);
      }
    }

    // Add user ID if authenticated and pattern contains {userId}
    const user = request.user as { id?: string } | undefined;
    if (user?.id) {
      key = key.replace(/\{userId\}/g, user.id);
    }

    // Handle pagination in key
    const page = String(request.query.page || '1');
    const limit = String(request.query.limit || '20');
    key = key.replace(/\{page\}/g, page);
    key = key.replace(/\{limit\}/g, limit);

    return key;
  }

  private setCacheHeaders(
    response: Response,
    ttl: number,
    fromCache: boolean,
    cachedAt?: string,
    stale?: boolean,
  ): void {
    // Cache-Control header
    response.setHeader('Cache-Control', `private, max-age=${ttl}`);

    // Custom headers for debugging
    response.setHeader('X-Cache', fromCache ? 'HIT' : 'MISS');

    if (stale) {
      response.setHeader('X-Cache-Stale', 'true');
    }

    if (cachedAt) {
      response.setHeader('X-Cache-Date', cachedAt);
    }

    // ETag for conditional requests (simplified)
    if (fromCache && cachedAt) {
      const etag = Buffer.from(cachedAt).toString('base64').slice(0, 20);
      response.setHeader('ETag', `"${etag}"`);
    }
  }
}

/**
 * Lightweight cache interceptor that only caches specific routes.
 * Use this for fine-grained control over caching.
 */
@Injectable()
export class AutoCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AutoCacheInterceptor.name);
  private readonly defaultTtl = 60; // 1 minute

  // Routes to auto-cache (pattern -> TTL)
  private readonly autoCacheRoutes: Record<string, number> = {
    '/api/v1/categories': 3600,
    '/api/v1/trending': 300,
    '/api/v1/popular': 300,
  };

  constructor(private readonly cacheService: CacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Check if route should be auto-cached
    const path = request.path;
    const ttl = this.autoCacheRoutes[path];

    if (!ttl) {
      return next.handle();
    }

    // Build cache key from URL
    const cacheKey = `route:${path}:${JSON.stringify(request.query)}`;

    try {
      const cached = await this.cacheService.get<unknown>(cacheKey);

      if (cached) {
        response.setHeader('X-Cache', 'HIT');
        this.logger.debug(`Auto-cache HIT: ${cacheKey}`);
        return of(cached);
      }

      response.setHeader('X-Cache', 'MISS');
      return next.handle().pipe(
        tap((data) => {
          void this.cacheService.set(cacheKey, data, ttl);
        }),
      );
    } catch (error) {
      this.logger.error(`Auto-cache error for ${cacheKey}:`, error);
      return next.handle();
    }
  }
}
