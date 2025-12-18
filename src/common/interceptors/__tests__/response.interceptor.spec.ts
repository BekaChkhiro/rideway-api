import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { ResponseInterceptor } from '../response.interceptor';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
    mockExecutionContext = {} as ExecutionContext;
  });

  it('should transform simple data to standard response format', async () => {
    const testData = { id: 1, name: 'Test' };
    mockCallHandler = {
      handle: () => of(testData),
    };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(result).toEqual({
      success: true,
      data: testData,
    });
  });

  it('should transform array data to standard response format', async () => {
    const testData = [{ id: 1 }, { id: 2 }];
    mockCallHandler = {
      handle: () => of(testData),
    };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(result).toEqual({
      success: true,
      data: testData,
    });
  });

  it('should transform paginated response with meta', async () => {
    const paginatedData = {
      items: [{ id: 1 }, { id: 2 }],
      meta: {
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
      },
    };
    mockCallHandler = {
      handle: () => of(paginatedData),
    };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(result).toEqual({
      success: true,
      data: paginatedData.items,
      meta: paginatedData.meta,
    });
  });

  it('should handle null data', async () => {
    mockCallHandler = {
      handle: () => of(null),
    };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(result).toEqual({
      success: true,
      data: null,
    });
  });

  it('should handle string data', async () => {
    const testData = 'Hello World';
    mockCallHandler = {
      handle: () => of(testData),
    };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(result).toEqual({
      success: true,
      data: testData,
    });
  });

  it('should handle empty object', async () => {
    const testData = {};
    mockCallHandler = {
      handle: () => of(testData),
    };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(result).toEqual({
      success: true,
      data: testData,
    });
  });
});
