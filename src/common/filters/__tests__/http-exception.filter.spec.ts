import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: {
    status: Mock;
    json: Mock;
  };
  let mockRequest: {
    method: string;
    url: string;
    ip: string;
    get: Mock;
  };
  let mockArgumentsHost: {
    switchToHttp: Mock;
    getType: Mock;
  };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockRequest = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-user-agent'),
    };
    mockArgumentsHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
      getType: vi.fn().mockReturnValue('http'),
    };
  });

  it('should format BadRequestException correctly', () => {
    const exception = new BadRequestException('Invalid input');

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid input',
        details: undefined,
      },
    });
  });

  it('should format NotFoundException correctly', () => {
    const exception = new NotFoundException('Resource not found');

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        details: undefined,
      },
    });
  });

  it('should format UnauthorizedException correctly', () => {
    const exception = new UnauthorizedException('Unauthorized access');

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized access',
        details: undefined,
      },
    });
  });

  it('should format ForbiddenException correctly', () => {
    const exception = new ForbiddenException('Access denied');

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied',
        details: undefined,
      },
    });
  });

  it('should format validation errors with details', () => {
    const exception = new BadRequestException({
      message: ['email must be an email', 'password is too short'],
    });

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'email must be an email',
        details: ['email must be an email', 'password is too short'],
      },
    });
  });

  it('should format InternalServerErrorException correctly', () => {
    const exception = new InternalServerErrorException('Something went wrong');

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
        details: undefined,
      },
    });
  });

  it('should handle non-HttpException errors in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const exception = new Error('Unexpected error');

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: undefined,
      },
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should include error details in development for non-HttpException', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const exception = new Error('Unexpected development error');

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected development error',
        details: expect.arrayContaining([expect.any(String)]) as unknown,
      },
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should format HttpException with string response', () => {
    const exception = new HttpException(
      'Custom error message',
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Custom error message',
        details: undefined,
      },
    });
  });
});
