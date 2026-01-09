import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

import { config, isDev } from '../config';
import { verifyAccessToken } from '../utils/jwt';
import { AuthPayload } from '../types/api';
import { registerChatHandlers } from './handlers/chat.handler';

// Extend Socket type with user data
export interface AuthenticatedSocket extends Socket {
  user: AuthPayload;
}

// Online users tracking (userId -> Set of socketIds)
export const onlineUsers = new Map<string, Set<string>>();

let io: Server;

export function initializeSocket(server: HTTPServer): Server {
  io = new Server(server, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Setup Redis adapter for scaling
  if (config.redis.url) {
    try {
      const pubClient = new Redis(config.redis.url);
      const subClient = pubClient.duplicate();

      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.io Redis adapter connected');
    } catch (error) {
      console.warn('Socket.io Redis adapter failed, using default:', error);
    }
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = verifyAccessToken(token);
      if (!payload) {
        return next(new Error('Invalid token'));
      }

      (socket as AuthenticatedSocket).user = payload;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.user.userId;

    if (isDev) {
      console.log(`[Socket] User connected: ${userId} (${socket.id})`);
    }

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Broadcast online status
    socket.broadcast.emit('user:online', { userId });

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    // Register event handlers
    registerChatHandlers(io, authSocket);

    // Handle get online status
    socket.on('users:getOnline', (userIds: string[], callback) => {
      const onlineStatuses: Record<string, boolean> = {};
      for (const id of userIds) {
        onlineStatuses[id] = onlineUsers.has(id);
      }
      if (typeof callback === 'function') {
        callback(onlineStatuses);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      if (isDev) {
        console.log(`[Socket] User disconnected: ${userId} (${reason})`);
      }

      // Remove socket from online tracking
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast offline status
          socket.broadcast.emit('user:offline', { userId });
        }
      }
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

// Utility functions for sending events from outside socket handlers
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToConversation(conversationId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}
