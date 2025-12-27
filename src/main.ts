import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';
import {
  ResponseInterceptor,
  LoggingInterceptor,
  HttpExceptionFilter,
  ValidationPipe,
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

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Global pipes, interceptors, filters
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new LoggingInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger documentation
  if (nodeEnv !== 'production') {
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
        .addTag('health', 'Health check endpoints')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    } catch (error) {
      console.warn('Swagger documentation failed to generate:', (error as Error).message);
      console.warn('Swagger docs will not be available. Fix circular dependencies in DTOs/entities to enable.');
    }
  }

  await app.listen(port);
  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}
void bootstrap();
