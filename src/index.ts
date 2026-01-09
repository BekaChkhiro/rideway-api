import { createServer } from 'http';
import { app } from './app';
import { config } from './config';
import { prisma } from './config/database';
import { initializeSocket } from './socket';

const start = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected successfully');

    // Create HTTP server
    const server = createServer(app);

    // Initialize Socket.io
    initializeSocket(server);
    console.log('Socket.io initialized');

    // Start server
    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
      console.log(`WebSocket: ws://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

start();
