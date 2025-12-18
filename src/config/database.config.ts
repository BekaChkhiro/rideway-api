import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  const url = new URL(databaseUrl);

  return {
    type: 'postgres' as const,
    host: url.hostname,
    port: parseInt(url.port, 10) || 5432,
    username: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    autoLoadEntities: true,
  };
});
