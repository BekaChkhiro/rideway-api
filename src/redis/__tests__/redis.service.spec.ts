import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';

const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  hget: vi.fn(),
  hset: vi.fn(),
  hdel: vi.fn(),
  hgetall: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  ping: vi.fn(),
  flushdb: vi.fn(),
  on: vi.fn(),
  quit: vi.fn(),
};

vi.mock('ioredis', () => {
  return { default: vi.fn().mockImplementation(() => mockRedisClient) };
});

describe('RedisService', () => {
  let service: RedisService;
  let mockConfigService: Record<string, Mock>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigService = {
      get: vi.fn((key: string) => {
        const config: Record<string, unknown> = {
          'redis.url': 'redis://localhost:6379',
          'redis.maxRetries': 3,
          'redis.retryDelayMs': 1000,
          'redis.connectTimeoutMs': 10000,
        };
        return config[key];
      }),
    };

    service = new RedisService(mockConfigService as unknown as ConfigService);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('get', () => {
    it('should return value for existing key', async () => {
      mockRedisClient.get.mockResolvedValue('test-value');

      const result = await service.get('test-key');

      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(result).toBe('test-value');
    });

    it('should return null for non-existing key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('non-existing-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('test-key', 'test-value');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        'test-value',
      );
    });

    it('should set value with TTL', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await service.set('test-key', 'test-value', 300);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-key',
        300,
        'test-value',
      );
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.del('test-key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await service.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await service.exists('non-existing-key');

      expect(result).toBe(false);
    });
  });

  describe('expire', () => {
    it('should set TTL on key', async () => {
      mockRedisClient.expire.mockResolvedValue(1);

      await service.expire('test-key', 300);

      expect(mockRedisClient.expire).toHaveBeenCalledWith('test-key', 300);
    });
  });

  describe('keys', () => {
    it('should return matching keys', async () => {
      mockRedisClient.keys.mockResolvedValue(['key1', 'key2', 'key3']);

      const result = await service.keys('key*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('key*');
      expect(result).toEqual(['key1', 'key2', 'key3']);
    });
  });

  describe('hash operations', () => {
    it('should get hash field value', async () => {
      mockRedisClient.hget.mockResolvedValue('field-value');

      const result = await service.hget('hash-key', 'field');

      expect(mockRedisClient.hget).toHaveBeenCalledWith('hash-key', 'field');
      expect(result).toBe('field-value');
    });

    it('should set hash field value', async () => {
      mockRedisClient.hset.mockResolvedValue(1);

      await service.hset('hash-key', 'field', 'value');

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        'hash-key',
        'field',
        'value',
      );
    });

    it('should delete hash field', async () => {
      mockRedisClient.hdel.mockResolvedValue(1);

      await service.hdel('hash-key', 'field');

      expect(mockRedisClient.hdel).toHaveBeenCalledWith('hash-key', 'field');
    });

    it('should get all hash fields', async () => {
      const hashData = { field1: 'value1', field2: 'value2' };
      mockRedisClient.hgetall.mockResolvedValue(hashData);

      const result = await service.hgetall('hash-key');

      expect(mockRedisClient.hgetall).toHaveBeenCalledWith('hash-key');
      expect(result).toEqual(hashData);
    });
  });

  describe('pub/sub', () => {
    it('should publish message to channel', async () => {
      mockRedisClient.publish.mockResolvedValue(1);

      await service.publish('channel', 'message');

      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'channel',
        'message',
      );
    });
  });

  describe('ping', () => {
    it('should return true when Redis responds with PONG', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await service.ping();

      expect(result).toBe(true);
    });

    it('should return false when Redis fails to respond', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await service.ping();

      expect(result).toBe(false);
    });
  });
});
