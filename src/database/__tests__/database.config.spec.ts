import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import databaseConfig from '../../config/database.config';

describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should parse DATABASE_URL correctly', () => {
    process.env.DATABASE_URL = 'postgresql://myuser:mypass@myhost:5433/mydb';
    process.env.NODE_ENV = 'development';

    const config = databaseConfig();

    expect(config.host).toBe('myhost');
    expect(config.port).toBe(5433);
    expect(config.username).toBe('myuser');
    expect(config.password).toBe('mypass');
    expect(config.database).toBe('mydb');
  });

  it('should use default port 5432 when not specified', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/testdb';
    process.env.NODE_ENV = 'development';

    const config = databaseConfig();

    expect(config.port).toBe(5432);
  });

  it('should enable SSL in production', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    process.env.NODE_ENV = 'production';

    const config = databaseConfig();

    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('should disable SSL in development', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    process.env.NODE_ENV = 'development';

    const config = databaseConfig();

    expect(config.ssl).toBe(false);
  });

  it('should throw error when DATABASE_URL is not defined', () => {
    delete process.env.DATABASE_URL;

    expect(() => databaseConfig()).toThrow('DATABASE_URL is not defined');
  });

  it('should use default pool size of 10', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    delete process.env.DATABASE_POOL_SIZE;

    const config = databaseConfig();

    expect(config.poolSize).toBe(10);
  });

  it('should parse custom pool size', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    process.env.DATABASE_POOL_SIZE = '20';

    const config = databaseConfig();

    expect(config.poolSize).toBe(20);
  });

  it('should always set synchronize to false', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

    const config = databaseConfig();

    expect(config.synchronize).toBe(false);
  });

  it('should set type to postgres', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

    const config = databaseConfig();

    expect(config.type).toBe('postgres');
  });
});
