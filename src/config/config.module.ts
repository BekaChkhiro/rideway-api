import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import appConfig from './app.config.js';
import databaseConfig from './database.config.js';
import redisConfig from './redis.config.js';
import firebaseConfig from './firebase.config.js';
import r2Config from './r2.config.js';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, firebaseConfig, r2Config],
      validationSchema: Joi.object({
        // App
        NODE_ENV: Joi.string()
          .valid('development', 'staging', 'production')
          .default('development'),
        PORT: Joi.number().default(3000),
        API_PREFIX: Joi.string().default('api/v1'),

        // Database
        DATABASE_URL: Joi.string().required(),
        DATABASE_POOL_SIZE: Joi.number().default(10),

        // Redis
        REDIS_URL: Joi.string().required(),

        // JWT
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

        // Cloudflare R2
        R2_ACCOUNT_ID: Joi.string().optional(),
        R2_ACCESS_KEY_ID: Joi.string().optional(),
        R2_SECRET_ACCESS_KEY: Joi.string().optional(),
        R2_BUCKET_NAME: Joi.string().optional(),
        R2_PUBLIC_URL: Joi.string().optional(),

        // Firebase
        FIREBASE_PROJECT_ID: Joi.string().optional(),
        FIREBASE_PRIVATE_KEY: Joi.string().optional(),
        FIREBASE_CLIENT_EMAIL: Joi.string().optional(),

        // CORS
        FRONTEND_URL: Joi.string().default('http://localhost:3000'),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
})
export class ConfigModule {}
