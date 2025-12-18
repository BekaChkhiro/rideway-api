import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined');
}

const url = new URL(databaseUrl);

export default new DataSource({
  type: 'postgres',
  host: url.hostname,
  port: parseInt(url.port, 10) || 5432,
  username: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  entities: [__dirname + '/entities/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
