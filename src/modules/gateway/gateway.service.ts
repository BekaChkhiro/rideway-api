import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RedisService } from '@redis/redis.service.js';
import {
  ServerToClientEvents,
  ClientToServerEvents,
} from './interfaces/socket-events.interface.js';

// Redis key prefixes
const REDIS_KEYS = {
  ONLINE_USERS: 'online:users',
  SOCKET_TO_USER: 'socket:user:', // socket:user:{socketId} -> userId
  USER_TO_SOCKET: 'user:socket:', // user:socket:{userId} -> socketId
  USER_LAST_SEEN: 'user:lastseen:', // user:lastseen:{userId} -> timestamp
  TYPING: 'typing:', // typing:{conversationId} -> hash of userId -> timestamp
} as const;

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private server!: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(private readonly redisService: RedisService) {}

  setServer(server: Server<ClientToServerEvents, ServerToClientEvents>): void {
    this.server = server;
  }

  // Socket-User Mapping Methods

  async registerSocket(socketId: string, userId: string): Promise<void> {
    const redis = this.redisService.getClient();

    await Promise.all([
      // Map socket to user
      redis.set(`${REDIS_KEYS.SOCKET_TO_USER}${socketId}`, userId),
      // Map user to socket (overwrites previous socket for same user)
      redis.set(`${REDIS_KEYS.USER_TO_SOCKET}${userId}`, socketId),
      // Add to online users set
      redis.sadd(REDIS_KEYS.ONLINE_USERS, userId),
      // Update last seen
      redis.set(
        `${REDIS_KEYS.USER_LAST_SEEN}${userId}`,
        Date.now().toString(),
      ),
    ]);

    this.logger.debug(`Socket ${socketId} registered for user ${userId}`);
  }

  async unregisterSocket(socketId: string): Promise<string | null> {
    const redis = this.redisService.getClient();

    // Get userId from socket
    const userId = await redis.get(`${REDIS_KEYS.SOCKET_TO_USER}${socketId}`);
    if (!userId) {
      return null;
    }

    // Check if this is the current socket for the user (could be different if reconnected)
    const currentSocket = await redis.get(`${REDIS_KEYS.USER_TO_SOCKET}${userId}`);
    const isCurrentSocket = currentSocket === socketId;

    await Promise.all([
      // Remove socket mapping
      redis.del(`${REDIS_KEYS.SOCKET_TO_USER}${socketId}`),
      // Only remove user mapping and online status if this is the current socket
      ...(isCurrentSocket
        ? [
            redis.del(`${REDIS_KEYS.USER_TO_SOCKET}${userId}`),
            redis.srem(REDIS_KEYS.ONLINE_USERS, userId),
            redis.set(
              `${REDIS_KEYS.USER_LAST_SEEN}${userId}`,
              Date.now().toString(),
            ),
          ]
        : []),
    ]);

    this.logger.debug(`Socket ${socketId} unregistered for user ${userId}`);
    return isCurrentSocket ? userId : null;
  }

  async getUserSocket(userId: string): Promise<string | null> {
    return this.redisService.get(`${REDIS_KEYS.USER_TO_SOCKET}${userId}`);
  }

  async getUserIdFromSocket(socketId: string): Promise<string | null> {
    return this.redisService.get(`${REDIS_KEYS.SOCKET_TO_USER}${socketId}`);
  }

  // Online Status Methods

  async isUserOnline(userId: string): Promise<boolean> {
    const redis = this.redisService.getClient();
    const result = await redis.sismember(REDIS_KEYS.ONLINE_USERS, userId);
    return result === 1;
  }

  async getOnlineUsers(userIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();

    if (userIds.length === 0) {
      return result;
    }

    const redis = this.redisService.getClient();

    // Check each user's online status
    const pipeline = redis.pipeline();
    userIds.forEach((userId) => {
      pipeline.sismember(REDIS_KEYS.ONLINE_USERS, userId);
    });

    const results = await pipeline.exec();
    if (results) {
      userIds.forEach((userId, index) => {
        const [, isOnline] = results[index];
        result.set(userId, isOnline === 1);
      });
    }

    return result;
  }

  async getAllOnlineUsers(): Promise<string[]> {
    const redis = this.redisService.getClient();
    return redis.smembers(REDIS_KEYS.ONLINE_USERS);
  }

  async getLastSeen(userId: string): Promise<Date | null> {
    const timestamp = await this.redisService.get(
      `${REDIS_KEYS.USER_LAST_SEEN}${userId}`,
    );
    return timestamp ? new Date(parseInt(timestamp, 10)) : null;
  }

  // Emit Methods

  emitToUser<K extends keyof ServerToClientEvents>(
    userId: string,
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0],
  ): void {
    // Emit to user's personal room
    this.server.to(`user:${userId}`).emit(event, data as never);
  }

  emitToRoom<K extends keyof ServerToClientEvents>(
    room: string,
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0],
  ): void {
    this.server.to(room).emit(event, data as never);
  }

  emitToAll<K extends keyof ServerToClientEvents>(
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0],
  ): void {
    this.server.emit(event, data as never);
  }

  // Typing Indicator Methods

  async setTyping(
    conversationId: string,
    userId: string,
    isTyping: boolean,
  ): Promise<void> {
    const redis = this.redisService.getClient();
    const key = `${REDIS_KEYS.TYPING}${conversationId}`;

    if (isTyping) {
      // Set typing with timestamp, auto-expire after 5 seconds
      await redis.hset(key, userId, Date.now().toString());
      await redis.expire(key, 5);
    } else {
      await redis.hdel(key, userId);
    }
  }

  async getTypingUsers(conversationId: string): Promise<string[]> {
    const redis = this.redisService.getClient();
    const key = `${REDIS_KEYS.TYPING}${conversationId}`;
    const typingData = await redis.hgetall(key);

    const now = Date.now();
    const TYPING_TIMEOUT = 5000; // 5 seconds

    return Object.entries(typingData)
      .filter(([, timestamp]) => now - parseInt(timestamp, 10) < TYPING_TIMEOUT)
      .map(([userId]) => userId);
  }

  // Room Methods

  async joinRoom(socketId: string, room: string): Promise<void> {
    const socket = this.server.sockets.sockets.get(socketId);
    if (socket) {
      await socket.join(room);
      this.logger.debug(`Socket ${socketId} joined room ${room}`);
    }
  }

  async leaveRoom(socketId: string, room: string): Promise<void> {
    const socket = this.server.sockets.sockets.get(socketId);
    if (socket) {
      await socket.leave(room);
      this.logger.debug(`Socket ${socketId} left room ${room}`);
    }
  }

  getRoomMembers(room: string): string[] {
    const sockets = this.server.sockets.adapter.rooms.get(room);
    return sockets ? Array.from(sockets) : [];
  }

  // Utility Methods

  getConnectedClientsCount(): number {
    return this.server.sockets.sockets.size;
  }

  async disconnectUser(userId: string, reason?: string): Promise<void> {
    const socketId = await this.getUserSocket(userId);
    if (socketId) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
        this.logger.log(`Disconnected user ${userId}: ${reason || 'No reason'}`);
      }
    }
  }
}
