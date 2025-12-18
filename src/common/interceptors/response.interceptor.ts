import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse,
  PaginatedResponse,
} from '../interfaces/api-response.interface.js';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: unknown): ApiResponse<T> => {
        if (this.isPaginatedResponse(data)) {
          return {
            success: true,
            data: data.items as T,
            meta: data.meta,
          };
        }

        return {
          success: true,
          data: data as T,
        };
      }),
    );
  }

  private isPaginatedResponse(
    data: unknown,
  ): data is PaginatedResponse<unknown> {
    return (
      typeof data === 'object' &&
      data !== null &&
      'items' in data &&
      'meta' in data &&
      Array.isArray((data as PaginatedResponse<unknown>).items)
    );
  }
}
