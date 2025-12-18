import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  maxRetries: 3,
  retryDelayMs: 1000,
  connectTimeoutMs: 10000,
}));
