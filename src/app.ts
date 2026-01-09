import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { config, isDev } from './config';
import { errorHandler } from './middleware';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import mediaRoutes from './routes/media.routes';
import postsRoutes from './routes/posts.routes';
import storiesRoutes from './routes/stories.routes';
import chatRoutes from './routes/chat.routes';
import notificationsRoutes from './routes/notifications.routes';
import listingsRoutes from './routes/listings.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Compression
app.use(compression());

// Logging
if (isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/posts', postsRoutes);
app.use('/api/v1/stories', storiesRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/listings', listingsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

// Error handler
app.use(errorHandler);

export { app };
