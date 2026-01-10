import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // App
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Cloudflare R2
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME || 'rideway-media',
    endpoint: process.env.R2_ENDPOINT,
    publicUrl: process.env.R2_PUBLIC_URL,
  },

  // Email
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.EMAIL_FROM || 'Rideway <noreply@rideway.ge>',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
} as const;

export const isDev = config.nodeEnv === 'development';
export const isProd = config.nodeEnv === 'production';
