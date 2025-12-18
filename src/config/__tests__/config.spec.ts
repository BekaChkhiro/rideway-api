import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import appConfig from '../app.config';
import databaseConfig from '../database.config';
import redisConfig from '../redis.config';

describe('ConfigService', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.API_PREFIX = 'api/v1';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    process.env.DATABASE_POOL_SIZE = '10';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig, databaseConfig, redisConfig],
          ignoreEnvFile: true,
        }),
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.API_PREFIX;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_POOL_SIZE;
    delete process.env.REDIS_URL;
    delete process.env.FRONTEND_URL;
  });

  describe('app config', () => {
    it('should load NODE_ENV correctly', () => {
      expect(configService.get<string>('app.nodeEnv')).toBe('development');
    });

    it('should load PORT correctly', () => {
      expect(configService.get<number>('app.port')).toBe(3000);
    });

    it('should load API_PREFIX correctly', () => {
      expect(configService.get<string>('app.apiPrefix')).toBe('api/v1');
    });

    it('should load FRONTEND_URL correctly', () => {
      expect(configService.get<string>('app.frontendUrl')).toBe(
        'http://localhost:3000',
      );
    });
  });

  describe('database config', () => {
    it('should parse DATABASE_URL correctly', () => {
      expect(configService.get<string>('database.host')).toBe('localhost');
      expect(configService.get<number>('database.port')).toBe(5432);
      expect(configService.get<string>('database.username')).toBe('user');
      expect(configService.get<string>('database.password')).toBe('pass');
      expect(configService.get<string>('database.database')).toBe('testdb');
    });

    it('should load DATABASE_POOL_SIZE correctly', () => {
      expect(configService.get<number>('database.poolSize')).toBe(10);
    });

    it('should set synchronize to false', () => {
      expect(configService.get<boolean>('database.synchronize')).toBe(false);
    });

    it('should enable logging in development', () => {
      expect(configService.get<boolean>('database.logging')).toBe(true);
    });
  });

  describe('redis config', () => {
    it('should load REDIS_URL correctly', () => {
      expect(configService.get<string>('redis.url')).toBe(
        'redis://localhost:6379',
      );
    });

    it('should have default retry settings', () => {
      expect(configService.get<number>('redis.maxRetries')).toBe(3);
      expect(configService.get<number>('redis.retryDelayMs')).toBe(1000);
      expect(configService.get<number>('redis.connectTimeoutMs')).toBe(10000);
    });
  });
});
