import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface LogContext {
  requestId?: string;
  userId?: string;
  duration?: number;
  method?: string;
  url?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  stack?: string;
}

@Injectable()
export class LoggingService implements NestLoggerService {
  private context = 'Application';
  private logger: winston.Logger;

  constructor() {
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const isProduction = process.env.NODE_ENV === 'production';
    const logDir = process.env.LOG_DIR || 'logs';

    // Custom format for structured logging
    const structuredFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
      winston.format.errors({ stack: true }),
      winston.format((info) => {
        // Sanitize sensitive data
        if (info.metadata) {
          info.metadata = this.sanitizeObject(
            info.metadata as Record<string, unknown>,
          );
        }
        return info;
      })(),
      winston.format.json(),
    );

    // Pretty format for development
    const prettyFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.colorize({ all: true }),
      winston.format.printf((info) => {
        const timestamp = String(info.timestamp || '');
        const level = String(info.level || 'info');
        const message = String(info.message || '');
        const context = String(info.context || 'App');
        const requestId = info.requestId ? String(info.requestId) : null;
        const duration =
          info.duration !== undefined ? Number(info.duration) : null;
        const stack = info.stack ? String(info.stack) : null;

        let log = `${timestamp} [${level}] [${context}]`;
        if (requestId) log += ` [${requestId}]`;
        log += ` ${message}`;
        if (duration !== null) log += ` (${duration}ms)`;
        if (stack) log += `\n${stack}`;
        return log;
      }),
    );

    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        format: isProduction ? structuredFormat : prettyFormat,
        level: isProduction ? 'info' : 'debug',
      }),
    ];

    // File transports for production
    if (isProduction) {
      // All logs
      transports.push(
        new DailyRotateFile({
          dirname: logDir,
          filename: 'app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: structuredFormat,
          level: 'info',
        }),
      );

      // Error logs
      transports.push(
        new DailyRotateFile({
          dirname: logDir,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          format: structuredFormat,
          level: 'error',
        }),
      );

      // Audit logs (info level only for audit events)
      transports.push(
        new DailyRotateFile({
          dirname: logDir,
          filename: 'audit-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '90d',
          format: structuredFormat,
          level: 'info',
        }),
      );
    }

    return winston.createLogger({
      level: isProduction ? 'info' : 'debug',
      defaultMeta: { service: 'bike-area-api' },
      transports,
    });
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: string | LogContext): void {
    this.writeLog('info', message, context);
  }

  info(message: string, context?: string | LogContext): void {
    this.writeLog('info', message, context);
  }

  error(message: string, trace?: string, context?: string | LogContext): void {
    const logContext =
      typeof context === 'string' ? { context } : context || {};
    this.logger.error({
      message,
      context: typeof context === 'string' ? context : this.context,
      stack: trace,
      ...logContext,
    });
  }

  warn(message: string, context?: string | LogContext): void {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: string | LogContext): void {
    this.writeLog('debug', message, context);
  }

  verbose(message: string, context?: string | LogContext): void {
    this.writeLog('verbose', message, context);
  }

  private writeLog(
    level: string,
    message: string,
    context?: string | LogContext,
  ): void {
    const logContext = typeof context === 'string' ? {} : context || {};
    const contextName = typeof context === 'string' ? context : this.context;

    this.logger.log(level, message, {
      context: contextName,
      ...logContext,
    });
  }

  // Structured logging methods
  logRequest(method: string, url: string, context: LogContext = {}): void {
    this.logger.info('Incoming request', {
      context: 'HTTP',
      method,
      url,
      ...context,
    });
  }

  logResponse(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context: LogContext = {},
  ): void {
    const level =
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.logger.log(level, 'Request completed', {
      context: 'HTTP',
      method,
      url,
      statusCode,
      duration,
      ...context,
    });
  }

  logError(error: Error, context: LogContext = {}): void {
    this.logger.error(error.message, {
      context: 'Error',
      stack: error.stack,
      name: error.name,
      ...context,
    });
  }

  logAudit(
    action: string,
    userId: string,
    details: Record<string, unknown> = {},
  ): void {
    this.logger.info(`Audit: ${action}`, {
      context: 'Audit',
      userId,
      action,
      metadata: details,
    });
  }

  logPerformance(
    operation: string,
    duration: number,
    context: LogContext = {},
  ): void {
    const level = duration > 1000 ? 'warn' : 'info';
    this.logger.log(level, `Performance: ${operation}`, {
      context: 'Performance',
      operation,
      duration,
      slow: duration > 1000,
      ...context,
    });
  }

  logSecurity(
    event: string,
    ip: string,
    details: Record<string, unknown> = {},
  ): void {
    this.logger.warn(`Security: ${event}`, {
      context: 'Security',
      event,
      ip,
      metadata: details,
    });
  }

  // Utility methods
  private sanitizeObject(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
      'authorization',
      'cookie',
      'creditCard',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some((sk) => lowerKey.includes(sk));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Get the underlying Winston logger
  getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}
