import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Simple test module without database dependencies
import { Controller, Get, Module } from '@nestjs/common';

interface SwaggerDocResponse {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  components: {
    securitySchemes: {
      'JWT-auth': {
        type: string;
        scheme: string;
      };
    };
  };
}

@Controller()
class TestController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }
}

@Module({
  controllers: [TestController],
})
class TestModule {}

describe('Swagger Documentation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Setup Swagger
    const config = new DocumentBuilder()
      .setTitle('Bike Area API')
      .setDescription('Backend API for Bike Area mobile application')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Swagger Documentation', () => {
    it('GET /api/docs should return HTML page', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/docs')
        .expect(200);

      expect(response.text).toContain('swagger');
    });

    it('GET /api/docs-json should return OpenAPI JSON', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200);

      const body = response.body as SwaggerDocResponse;
      expect(body.openapi).toBeDefined();
      expect(body.info.title).toBe('Bike Area API');
      expect(body.info.version).toBe('1.0');
    });

    it('Swagger should have bearer authentication configured', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200);

      const body = response.body as SwaggerDocResponse;
      expect(body.components.securitySchemes).toBeDefined();
      expect(body.components.securitySchemes['JWT-auth']).toBeDefined();
      expect(body.components.securitySchemes['JWT-auth'].type).toBe('http');
      expect(body.components.securitySchemes['JWT-auth'].scheme).toBe('bearer');
    });
  });
});
