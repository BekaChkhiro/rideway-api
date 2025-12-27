import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'socket.io';
import { RedisService } from '@redis/redis.service.js';
import { UserActivity, UserFollow } from '@database/index.js';
import {
  ServerToClientEvents,
  ClientToServerEvents,
} from './interfaces/socket-events.interface.js';

// Redis key prefixes
const REDIS_KEYS = {
  ONLINE_USERS: 'online:users',
  SOCKET_TO_USER: 'socket:user:', // socket:user:{socketId} -> userId
  USER_SOCKETS: 'user:sockets:', // user:sockets:{userId} -> Set of socketIds
  USER_LAST_SEEN: 'user:lastseen:', // user:lastseen:{userId} -> timestamp
  USER_APPEAR_OFFLINE: 'user:appear_offline:', // user:appear_offline:{userId} -> "1" or absent
  TYPING: 'typing:', // typing:{conversationId} -> hash of userId -> timestamp
} as const;

export interface OnlineStatusInfo {
  isOnline: boolean;
  lastSeen?: Date;
  appearOffline?: boolean;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private server!: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @InjectRepository(UserActivity)
    private readonly userActivityRepository: Repository<UserActivity>,
    @InjectRepository(UserFollow)
    private readonly userFollowRepository: Repository<UserFollow>,
  ) {}

  setServer(server: Server<ClientToServerEvents, ServerToClientEvents>): void {
    this.server = server;
  }

  // ==========================================
  // Socket-User Mapping Methods (Multi-device)
  // ==========================================

  async registerSocket(socketId: string, userId: string): Promise<void> {
    const redis = this.redisService.getClient();

    // Check how many connections user already has
    const existingSockets = await redis.smembers(`${REDIS_KEYS.USER_SOCKETS}${userId}`);
    const wasOffline = existingSockets.length === 0;

    await Promise.all([
      // Map socket to user
      redis.set(`${REDIS_KEYS.SOCKET_TO_USER}${socketId}`, userId),
      // Add socket to user's socket set (supports multiple devices)
      redis.sadd(`${REDIS_KEYS.USER_SOCKETS}${userId}`, socketId),
      // Add to online users set
      redis.sadd(REDIS_KEYS.ONLINE_USERS, userId),
      // Update last seen
      redis.set(
        `${REDIS_KEYS.USER_LAST_SEEN}${userId}`,
        Date.now().toString(),
      ),
    ]);

    // Update database if coming online
    if (wasOffline) {
      await this.updateUserActivityDb(userId, true);
    } else {
      // Just increment connection count
      await this.incrementConnectionCount(userId);
    }

    this.logger.debug(
      `Socket ${socketId} registered for user ${userId} (total connections: ${existingSockets.length + 1})`,
    );
  }

  async unregisterSocket(socketId: string): Promise<string | null> {
    const redis = this.redisService.getClient();

    // Get userId from socket
    const userId = await redis.get(`${REDIS_KEYS.SOCKET_TO_USER}${socketId}`);
    if (!userId) {
      return null;
    }

    // Remove this socket from user's socket set
    await redis.srem(`${REDIS_KEYS.USER_SOCKETS}${userId}`, socketId);
    await redis.del(`${REDIS_KEYS.SOCKET_TO_USER}${socketId}`);

    // Check if user has any remaining connections
    const remainingSockets = await redis.smembers(`${REDIS_KEYS.USER_SOCKETS}${userId}`);
    const wentOffline = remainingSockets.length === 0;

    if (wentOffline) {
      await Promise.all([
        redis.srem(REDIS_KEYS.ONLINE_USERS, userId),
        redis.set(
          `${REDIS_KEYS.USER_LAST_SEEN}${userId}`,
          Date.now().toString(),
        ),
      ]);
      // Update database
      await this.updateUserActivityDb(userId, false);
    } else {
      // Just decrement connection count
      await this.decrementConnectionCount(userId);
    }

    this.logger.debug(
      `Socket ${socketId} unregistered for user ${userId} (remaining: ${remainingSockets.length})`,
    );

    return wentOffline ? userId : null;
  }

  async getUserSockets(userId: string): Promise<string[]> {
    const redis = this.redisService.getClient();
    return redis.smembers(`${REDIS_KEYS.USER_SOCKETS}${userId}`);
  }

  async getUserSocket(userId: string): Promise<string | null> {
    const sockets = await this.getUserSockets(userId);
    return sockets.length > 0 ? sockets[0] : null;
  }

  async getUserIdFromSocket(socketId: string): Promise<string | null> {
    return this.redisService.get(`${REDIS_KEYS.SOCKET_TO_USER}${socketId}`);
  }

  // ==========================================
  // Online Status Methods
  // ==========================================

  async setUserOnline(userId: string): Promise<void> {
    const redis = this.redisService.getClient();

    await Promise.all([
      redis.sadd(REDIS_KEYS.ONLINE_USERS, userId),
      redis.set(`${REDIS_KEYS.USER_LAST_SEEN}${userId}`, Date.now().toString()),
    ]);

    await this.updateUserActivityDb(userId, true);

    // Broadcast to followers
    await this.broadcastPresenceToFollowers(userId, true);
  }

  async setUserOffline(userId: string): Promise<void> {
    const redis = this.redisService.getClient();

    await Promise.all([
      redis.srem(REDIS_KEYS.ONLINE_USERS, userId),
      redis.set(`${REDIS_KEYS.USER_LAST_SEEN}${userId}`, Date.now().toString()),
    ]);

    await this.updateUserActivityDb(userId, false);

    // Broadcast to followers
    await this.broadcastPresenceToFollowers(userId, false);
  }

  async setAppearOffline(userId: string, appearOffline: boolean): Promise<void> {
    const redis = this.redisService.getClient();

    if (appearOffline) {
      await redis.set(`${REDIS_KEYS.USER_APPEAR_OFFLINE}${userId}`, '1');
    } else {
      await redis.del(`${REDIS_KEYS.USER_APPEAR_OFFLINE}${userId}`);
    }

    // Update database
    await this.userActivityRepository.upsert(
      { userId, appearOffline },
      ['userId'],
    );

    // Broadcast current status to followers
    const isOnline = await this.isUserOnline(userId);
    await this.broadcastPresenceToFollowers(userId, isOnline && !appearOffline);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const redis = this.redisService.getClient();
    const result = await redis.sismember(REDIS_KEYS.ONLINE_USERS, userId);
    return result === 1;
  }

  async isUserVisiblyOnline(userId: string): Promise<boolean> {
    const redis = this.redisService.getClient();

    const [isOnline, appearOffline] = await Promise.all([
      redis.sismember(REDIS_KEYS.ONLINE_USERS, userId),
      redis.get(`${REDIS_KEYS.USER_APPEAR_OFFLINE}${userId}`),
    ]);

    return isOnline === 1 && !appearOffline;
  }

  async getOnlineStatus(userId: string): Promise<OnlineStatusInfo> {
    const redis = this.redisService.getClient();

    const [isOnlineMember, appearOffline, lastSeenStr] = await Promise.all([
      redis.sismember(REDIS_KEYS.ONLINE_USERS, userId),
      redis.get(`${REDIS_KEYS.USER_APPEAR_OFFLINE}${userId}`),
      redis.get(`${REDIS_KEYS.USER_LAST_SEEN}${userId}`),
    ]);

    const isOnline = isOnlineMember === 1 && !appearOffline;
    const lastSeen = lastSeenStr ? new Date(parseInt(lastSeenStr, 10)) : undefined;

    return {
      isOnline,
      lastSeen,
      appearOffline: !!appearOffline,
    };
  }

  async getOnlineUsers(userIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();

    if (userIds.length === 0) {
      return result;
    }

    const redis = this.redisService.getClient();

    // Check each user's online status (considering appear offline)
    const pipeline = redis.pipeline();
    userIds.forEach((userId) => {
      pipeline.sismember(REDIS_KEYS.ONLINE_USERS, userId);
      pipeline.get(`${REDIS_KEYS.USER_APPEAR_OFFLINE}${userId}`);
    });

    const results = await pipeline.exec();
    if (results) {
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const [, isOnline] = results[i * 2];
        const [, appearOffline] = results[i * 2 + 1];
        result.set(userId, isOnline === 1 && !appearOffline);
      }
    }

    return result;
  }

  async getOnlineStatusBatch(
    userIds: string[],
  ): Promise<Map<string, OnlineStatusInfo>> {
    const result = new Map<string, OnlineStatusInfo>();

    if (userIds.length === 0) {
      return result;
    }

    const redis = this.redisService.getClient();
    const pipeline = redis.pipeline();

    userIds.forEach((userId) => {
      pipeline.sismember(REDIS_KEYS.ONLINE_USERS, userId);
      pipeline.get(`${REDIS_KEYS.USER_APPEAR_OFFLINE}${userId}`);
      pipeline.get(`${REDIS_KEYS.USER_LAST_SEEN}${userId}`);
    });

    const results = await pipeline.exec();
    if (results) {
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const [, isOnlineMember] = results[i * 3];
        const [, appearOffline] = results[i * 3 + 1];
        const [, lastSeenStr] = results[i * 3 + 2];

        const isOnline = isOnlineMember === 1 && !appearOffline;
        const lastSeen = lastSeenStr
          ? new Date(parseInt(lastSeenStr as string, 10))
          : undefined;

        result.set(userId, {
          isOnline,
          lastSeen,
          appearOffline: !!appearOffline,
        });
      }
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

    if (timestamp) {
      return new Date(parseInt(timestamp, 10));
    }

    // Fallback to database
    const activity = await this.userActivityRepository.findOne({
      where: { userId },
    });
    return activity?.lastSeenAt || null;
  }

  // ==========================================
  // Emit Methods
  // ==========================================

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

  // ==========================================
  // Typing Indicator Methods
  // ==========================================

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
      .map(([odUserId]) => odUserId);
  }

  // ==========================================
  // Room Methods
  // ==========================================

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

  // ==========================================
  // Utility Methods
  // ==========================================

  getConnectedClientsCount(): number {
    return this.server.sockets.sockets.size;
  }

  async disconnectUser(userId: string, reason?: string): Promise<void> {
    const sockets = await this.getUserSockets(userId);
    for (const socketId of sockets) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    }
    if (sockets.length > 0) {
      this.logger.log(
        `Disconnected user ${userId} (${sockets.length} connections): ${reason || 'No reason'}`,
      );
    }
  }

  async getConnectionCount(userId: string): Promise<number> {
    const redis = this.redisService.getClient();
    const sockets = await redis.smembers(`${REDIS_KEYS.USER_SOCKETS}${userId}`);
    return sockets.length;
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  private async updateUserActivityDb(
    userId: string,
    isOnline: boolean,
  ): Promise<void> {
    try {
      const existingActivity = await this.userActivityRepository.findOne({
        where: { userId },
      });

      if (existingActivity) {
        await this.userActivityRepository.update(userId, {
          isOnline,
          lastSeenAt: new Date(),
          activeConnections: isOnline ? 1 : 0,
        });
      } else {
        await this.userActivityRepository.insert({
          userId,
          isOnline,
          lastSeenAt: new Date(),
          activeConnections: isOnline ? 1 : 0,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to update user activity: ${(error as Error).message}`);
    }
  }

  private async incrementConnectionCount(userId: string): Promise<void> {
    try {
      await this.userActivityRepository.increment(
        { userId },
        'activeConnections',
        1,
      );
    } catch (error) {
      this.logger.error(`Failed to increment connection count: ${(error as Error).message}`);
    }
  }

  private async decrementConnectionCount(userId: string): Promise<void> {
    try {
      await this.userActivityRepository.decrement(
        { userId },
        'activeConnections',
        1,
      );
    } catch (error) {
      this.logger.error(`Failed to decrement connection count: ${(error as Error).message}`);
    }
  }

  private async broadcastPresenceToFollowers(
    userId: string,
    isOnline: boolean,
  ): Promise<void> {
    try {
      // Get followers who should see this user's status
      const followers = await this.userFollowRepository.find({
        where: { followingId: userId },
        select: ['followerId'],
      });

      const event = isOnline ? 'user:online' : 'user:offline';

      // Emit to each follower's personal room
      for (const follow of followers) {
        this.emitToUser(follow.followerId, event, userId);
      }

      this.logger.debug(
        `Broadcast ${event} for user ${userId} to ${followers.length} followers`,
      );
    } catch (error) {
      this.logger.error(`Failed to broadcast presence: ${(error as Error).message}`);
      // Fallback to global broadcast if followers query fails
      this.server.emit(isOnline ? 'user:online' : 'user:offline', userId);
    }
  }
}
