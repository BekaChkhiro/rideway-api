import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import {
  ResponseInterceptor,
  LoggingInterceptor,
  ValidationPipe,
  AllExceptionsFilter,
  SanitizeInterceptor,
} from './common/index.js';

async function bootstrap() {
  console.log('Starting NestFactory.create...');
  const app = await NestFactory.create(AppModule);
  console.log('NestFactory.create completed successfully!');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'api/v1';
  const nodeEnv = configService.get<string>('app.nodeEnv');
  const frontendUrl = configService.get<string>('app.frontendUrl');
  const isProduction = nodeEnv === 'production';

  // Security headers with Helmet
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      // X-Frame-Options: DENY
      frameguard: { action: 'deny' },
      // X-Content-Type-Options: nosniff
      noSniff: true,
      // X-XSS-Protection
      xssFilter: true,
      // Strict-Transport-Security
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      // X-DNS-Prefetch-Control
      dnsPrefetchControl: { allow: false },
      // X-Download-Options
      ieNoOpen: true,
      // X-Permitted-Cross-Domain-Policies
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      // Referrer-Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Cross-Origin-Embedder-Policy (disabled for API compatibility)
      crossOriginEmbedderPolicy: false,
      // Cross-Origin-Opener-Policy
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      // Cross-Origin-Resource-Policy
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  // Compression
  app.use(compression());

  // Request body size limits
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CORS configuration
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:3000',
    'http://localhost:8081', // React Native development
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is allowed
      if (
        allowedOrigins.some((allowed) => {
          if (allowed.includes('*')) {
            const pattern = new RegExp(allowed.replace('*', '.*'));
            return pattern.test(origin);
          }
          return allowed === origin;
        })
      ) {
        callback(null, true);
        return;
      }

      // In development, allow all origins
      if (!isProduction) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Global pipes, interceptors, filters
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(
    new SanitizeInterceptor(),
    new ResponseInterceptor(),
    new LoggingInterceptor(),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger documentation
  if (!isProduction) {
    try {
      const config = new DocumentBuilder()
        .setTitle('Bike Area API')
        .setDescription('Backend API for Bike Area mobile application')
        .setVersion('1.0')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            name: 'JWT',
            description: 'Enter JWT token',
            in: 'header',
          },
          'JWT-auth',
        )
        .addTag('auth', 'Authentication endpoints')
        .addTag('users', 'User management endpoints')
        .addTag('admin', 'Admin endpoints')
        .addTag('health', 'Health check endpoints')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    } catch (error) {
      console.warn(
        'Swagger documentation failed to generate:',
        (error as Error).message,
      );
      console.warn(
        'Swagger docs will not be available. Fix circular dependencies in DTOs/entities to enable.',
      );
    }
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  if (!isProduction) {
    console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  }
}
void bootstrap();
