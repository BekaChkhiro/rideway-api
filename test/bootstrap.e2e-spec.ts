import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule } from '@nestjs/config';
import { Controller, Get, Module, Injectable } from '@nestjs/common';
import {
  TerminusModule,
  HealthCheckService,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import appConfig from '../src/config/app.config';
import {
  ResponseInterceptor,
  LoggingInterceptor,
  HttpExceptionFilter,
  ValidationPipe,
} from '../src/common';

interface HealthResponse {
  success: boolean;
  data: {
    status: string;
    info: {
      database: { status: string };
      redis: { status: string };
    };
  };
}

interface ApiSuccessResponse {
  success: boolean;
  data: string;
}

interface ApiErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
}

// Mock Database Health Indicator
@Injectable()
class MockDatabaseHealthIndicator extends HealthIndicator {
  isHealthy(key: string): HealthIndicatorResult {
    return this.getStatus(key, true);
  }
}

// Mock Redis Health Indicator
@Injectable()
class MockRedisHealthIndicator extends HealthIndicator {
  isHealthy(key: string): HealthIndicatorResult {
    return this.getStatus(key, true);
  }
}

// Mock Health Controller
@Controller('health')
class MockHealthController {
  constructor(
    private health: HealthCheckService,
    private db: MockDatabaseHealthIndicator,
    private redis: MockRedisHealthIndicator,
  ) {}

  @Get()
  check() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('db')
  checkDb() {
    return this.health.check([() => this.db.isHealthy('database')]);
  }

  @Get('redis')
  checkRedis() {
    return this.health.check([() => this.redis.isHealthy('redis')]);
  }
}

// App Controller
@Controller()
class AppController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      ignoreEnvFile: true,
    }),
    TerminusModule,
  ],
  controllers: [AppController, MockHealthController],
  providers: [MockDatabaseHealthIndicator, MockRedisHealthIndicator],
})
class TestAppModule {}

describe('Application Bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.API_PREFIX = 'api/v1';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global configurations like in main.ts
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(
      new ResponseInterceptor(),
      new LoggingInterceptor(),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Application Bootstrap', () => {
    it('should bootstrap without errors', () => {
      expect(app).toBeDefined();
    });

    it('should have global prefix configured', async () => {
      // Root without prefix should return 404
      await request(app.getHttpServer()).get('/').expect(404);

      // With prefix should work
      await request(app.getHttpServer()).get('/api/v1').expect(200);
    });
  });

  describe('Database Connection (mocked)', () => {
    it('should return healthy status for database', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/db')
        .expect(200);

      // Response is wrapped by ResponseInterceptor
      const body = response.body as HealthResponse;
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
      expect(body.data.info.database.status).toBe('up');
    });
  });

  describe('Redis Connection (mocked)', () => {
    it('should return healthy status for redis', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/redis')
        .expect(200);

      const body = response.body as HealthResponse;
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
      expect(body.data.info.redis.status).toBe('up');
    });
  });

  describe('Health Check Endpoint', () => {
    it('GET /api/v1/health should return OK status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const body = response.body as HealthResponse;
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
      expect(body.data.info).toBeDefined();
      expect(body.data.info.database).toBeDefined();
      expect(body.data.info.redis).toBeDefined();
    });

    it('should include both database and redis in health check', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const body = response.body as HealthResponse;
      expect(body.data.info.database.status).toBe('up');
      expect(body.data.info.redis.status).toBe('up');
    });
  });

  describe('Standard Response Format', () => {
    it('GET /api/v1 should return success response format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1')
        .expect(200);

      const body = response.body as ApiSuccessResponse;
      expect(body.success).toBe(true);
      expect(body.data).toBe('Hello World!');
    });
  });

  describe('Error Handling', () => {
    it('should return standard error format for 404', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/non-existent-route')
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBeDefined();
    });
  });
});
