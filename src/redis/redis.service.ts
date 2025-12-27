import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private subscriber!: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.get<string>('redis.url')!;
    const maxRetries = this.configService.get<number>('redis.maxRetries') ?? 3;
    const retryDelayMs =
      this.configService.get<number>('redis.retryDelayMs') ?? 1000;
    const connectTimeoutMs =
      this.configService.get<number>('redis.connectTimeoutMs') ?? 10000;

    const redisOptions: RedisOptions = {
      maxRetriesPerRequest: maxRetries,
      connectTimeout: connectTimeoutMs,
      retryStrategy: (times: number) => {
        if (times > maxRetries) {
          this.logger.error(`Redis connection failed after ${times} attempts`);
          return null;
        }
        const delay = Math.min(times * retryDelayMs, 5000);
        this.logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
    };

    this.client = new Redis(url, redisOptions);
    this.subscriber = new Redis(url, redisOptions);

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis client error: ${error.message}`);
    });

    this.subscriber.on('error', (error: Error) => {
      this.logger.error(`Redis subscriber error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
    await this.subscriber?.quit();
    this.logger.log('Redis connections closed');
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch: string, message: string) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async flushdb(): Promise<void> {
    await this.client.flushdb();
  }
}
