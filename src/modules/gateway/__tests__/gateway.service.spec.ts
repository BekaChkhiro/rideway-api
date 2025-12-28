import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { GatewayService } from '../gateway.service.js';
import { UserActivity, UserFollow } from '@database/index.js';

describe('GatewayService', () => {
  let service: GatewayService;
  let mockRedisService: Record<string, Mock>;
  let mockRedisClient: Record<string, Mock>;
  let mockUserActivityRepo: Record<string, Mock>;
  let mockUserFollowRepo: Record<string, Mock>;
  let mockServer: Partial<Server>;

  const userId = 'user-uuid-1234';
  const userId2 = 'user-uuid-5678';
  const socketId1 = 'socket-1';
  const socketId2 = 'socket-2';

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedisClient = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      sadd: vi.fn().mockResolvedValue(1),
      srem: vi.fn().mockResolvedValue(1),
      smembers: vi.fn().mockResolvedValue([]),
      sismember: vi.fn().mockResolvedValue(0),
      hset: vi.fn().mockResolvedValue(1),
      hget: vi.fn().mockResolvedValue(null),
      hdel: vi.fn().mockResolvedValue(1),
      hgetall: vi.fn().mockResolvedValue({}),
      expire: vi.fn().mockResolvedValue(1),
      pipeline: vi.fn().mockReturnValue({
        sismember: vi.fn().mockReturnThis(),
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }),
    };

    mockRedisService = {
      getClient: vi.fn().mockReturnValue(mockRedisClient),
      get: vi.fn().mockResolvedValue(null),
    };

    mockUserActivityRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      insert: vi.fn().mockResolvedValue({ identifiers: [{ userId }] }),
      upsert: vi.fn().mockResolvedValue(undefined),
      increment: vi.fn().mockResolvedValue({ affected: 1 }),
      decrement: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    mockUserFollowRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockServer = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      sockets: {
        sockets: new Map(),
        adapter: {
          rooms: new Map(),
        },
      } as any,
    };

    service = new GatewayService(
      mockRedisService as any,
      mockUserActivityRepo as any,
      mockUserFollowRepo as any,
    );

    service.setServer(mockServer as Server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerSocket', () => {
    it('should register socket and add to online users', async () => {
      // Arrange
      mockRedisClient.smembers.mockResolvedValue([]); // No existing sockets

      // Act
      await service.registerSocket(socketId1, userId);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `socket:user:${socketId1}`,
        userId,
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        `user:sockets:${userId}`,
        socketId1,
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith('online:users', userId);
      expect(mockUserActivityRepo.insert).toHaveBeenCalled();
    });

    it('should increment connection count for existing user', async () => {
      // Arrange
      mockRedisClient.smembers.mockResolvedValue([socketId1]); // Already has one socket

      // Act
      await service.registerSocket(socketId2, userId);

      // Assert
      expect(mockUserActivityRepo.increment).toHaveBeenCalledWith(
        { userId },
        'activeConnections',
        1,
      );
    });

    it('should handle multiple devices for same user', async () => {
      // Arrange - First device
      mockRedisClient.smembers.mockResolvedValueOnce([]);
      await service.registerSocket(socketId1, userId);

      // Arrange - Second device
      mockRedisClient.smembers.mockResolvedValueOnce([socketId1]);
      await service.registerSocket(socketId2, userId);

      // Assert
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        `user:sockets:${userId}`,
        socketId1,
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        `user:sockets:${userId}`,
        socketId2,
      );
    });
  });

  describe('unregisterSocket', () => {
    it('should return userId when last socket disconnects', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(userId);
      mockRedisClient.smembers.mockResolvedValue([]); // No remaining sockets

      // Act
      const result = await service.unregisterSocket(socketId1);

      // Assert
      expect(result).toBe(userId);
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        `user:sockets:${userId}`,
        socketId1,
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `socket:user:${socketId1}`,
      );
      expect(mockRedisClient.srem).toHaveBeenCalledWith('online:users', userId);
    });

    it('should return null when other sockets still connected', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(userId);
      mockRedisClient.smembers.mockResolvedValue([socketId2]); // Still has one socket

      // Act
      const result = await service.unregisterSocket(socketId1);

      // Assert
      expect(result).toBeNull();
      expect(mockUserActivityRepo.decrement).toHaveBeenCalled();
    });

    it('should return null for unknown socket', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      const result = await service.unregisterSocket('unknown-socket');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('setUserOnline', () => {
    it('should add user to online set and update database', async () => {
      // Act
      await service.setUserOnline(userId);

      // Assert
      expect(mockRedisClient.sadd).toHaveBeenCalledWith('online:users', userId);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `user:lastseen:${userId}`,
        expect.any(String),
      );
    });

    it('should broadcast online status to followers', async () => {
      // Arrange
      mockUserFollowRepo.find.mockResolvedValue([
        { followerId: 'follower-1' },
        { followerId: 'follower-2' },
      ]);

      // Act
      await service.setUserOnline(userId);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('user:follower-1');
      expect(mockServer.to).toHaveBeenCalledWith('user:follower-2');
    });
  });

  describe('setUserOffline', () => {
    it('should remove user from online set and update database', async () => {
      // Act
      await service.setUserOffline(userId);

      // Assert
      expect(mockRedisClient.srem).toHaveBeenCalledWith('online:users', userId);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `user:lastseen:${userId}`,
        expect.any(String),
      );
    });

    it('should broadcast offline status to followers', async () => {
      // Arrange
      mockUserFollowRepo.find.mockResolvedValue([{ followerId: 'follower-1' }]);

      // Act
      await service.setUserOffline(userId);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('user:follower-1');
    });
  });

  describe('isUserOnline', () => {
    it('should return true if user is in online set', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1);

      // Act
      const result = await service.isUserOnline(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockRedisClient.sismember).toHaveBeenCalledWith(
        'online:users',
        userId,
      );
    });

    it('should return false if user is not in online set', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(0);

      // Act
      const result = await service.isUserOnline(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isUserVisiblyOnline', () => {
    it('should return true if online and not appearing offline', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1);
      mockRedisClient.get.mockResolvedValue(null); // Not appearing offline

      // Act
      const result = await service.isUserVisiblyOnline(userId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if online but appearing offline', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1);
      mockRedisClient.get.mockResolvedValue('1'); // Appearing offline

      // Act
      const result = await service.isUserVisiblyOnline(userId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false if not online', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(0);

      // Act
      const result = await service.isUserVisiblyOnline(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('setAppearOffline', () => {
    it('should set appear offline flag in Redis and database', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1); // User is online

      // Act
      await service.setAppearOffline(userId, true);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `user:appear_offline:${userId}`,
        '1',
      );
      expect(mockUserActivityRepo.upsert).toHaveBeenCalledWith(
        { userId, appearOffline: true },
        ['userId'],
      );
    });

    it('should clear appear offline flag', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1);

      // Act
      await service.setAppearOffline(userId, false);

      // Assert
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `user:appear_offline:${userId}`,
      );
    });
  });

  describe('getOnlineStatus', () => {
    it('should return full online status info', async () => {
      // Arrange
      const lastSeenTimestamp = Date.now().toString();
      mockRedisClient.sismember.mockResolvedValue(1);
      mockRedisClient.get
        .mockResolvedValueOnce(null) // appear offline
        .mockResolvedValueOnce(lastSeenTimestamp); // last seen

      // Act
      const result = await service.getOnlineStatus(userId);

      // Assert
      expect(result).toEqual({
        isOnline: true,
        lastSeen: expect.any(Date),
        appearOffline: false,
      });
    });
  });

  describe('setTyping', () => {
    it('should set typing indicator in Redis', async () => {
      // Arrange
      const conversationId = 'conv-uuid-1234';

      // Act
      await service.setTyping(conversationId, userId, true);

      // Assert
      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        `typing:${conversationId}`,
        userId,
        expect.any(String),
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        `typing:${conversationId}`,
        5,
      );
    });

    it('should clear typing indicator', async () => {
      // Arrange
      const conversationId = 'conv-uuid-1234';

      // Act
      await service.setTyping(conversationId, userId, false);

      // Assert
      expect(mockRedisClient.hdel).toHaveBeenCalledWith(
        `typing:${conversationId}`,
        userId,
      );
    });
  });

  describe('getTypingUsers', () => {
    it('should return active typing users', async () => {
      // Arrange
      const conversationId = 'conv-uuid-1234';
      const now = Date.now();
      mockRedisClient.hgetall.mockResolvedValue({
        [userId]: (now - 1000).toString(), // Active (1 second ago)
        [userId2]: (now - 10000).toString(), // Expired (10 seconds ago)
      });

      // Act
      const result = await service.getTypingUsers(conversationId);

      // Assert
      expect(result).toContain(userId);
      expect(result).not.toContain(userId2);
    });

    it('should return empty array if no one is typing', async () => {
      // Arrange
      mockRedisClient.hgetall.mockResolvedValue({});

      // Act
      const result = await service.getTypingUsers('conv-uuid');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('emitToUser', () => {
    it('should emit to user room', () => {
      // Arrange
      const emitMock = vi.fn();
      (mockServer.to as Mock).mockReturnValue({ emit: emitMock });

      // Act
      service.emitToUser(userId, 'notification:new', { test: 'data' } as any);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(emitMock).toHaveBeenCalledWith('notification:new', {
        test: 'data',
      });
    });
  });

  describe('emitToRoom', () => {
    it('should emit to specified room', () => {
      // Arrange
      const emitMock = vi.fn();
      (mockServer.to as Mock).mockReturnValue({ emit: emitMock });
      const room = 'conversation:conv-uuid';

      // Act
      service.emitToRoom(room, 'message:new', { content: 'Hello' } as any);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith(room);
      expect(emitMock).toHaveBeenCalledWith('message:new', {
        content: 'Hello',
      });
    });
  });

  describe('getConnectionCount', () => {
    it('should return number of active connections for user', async () => {
      // Arrange
      mockRedisClient.smembers.mockResolvedValue([socketId1, socketId2]);

      // Act
      const result = await service.getConnectionCount(userId);

      // Assert
      expect(result).toBe(2);
    });

    it('should return 0 for offline user', async () => {
      // Arrange
      mockRedisClient.smembers.mockResolvedValue([]);

      // Act
      const result = await service.getConnectionCount(userId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('getLastSeen', () => {
    it('should return last seen from Redis', async () => {
      // Arrange
      const timestamp = Date.now().toString();
      mockRedisService.get.mockResolvedValue(timestamp);

      // Act
      const result = await service.getLastSeen(userId);

      // Assert
      expect(result).toBeInstanceOf(Date);
    });

    it('should fallback to database if not in Redis', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      const lastSeenAt = new Date();
      mockUserActivityRepo.findOne.mockResolvedValue({ lastSeenAt });

      // Act
      const result = await service.getLastSeen(userId);

      // Assert
      expect(result).toEqual(lastSeenAt);
    });

    it('should return null if no last seen data', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      mockUserActivityRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getLastSeen(userId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Multi-device support', () => {
    it('should track multiple socket connections per user', async () => {
      // Simulate first connection
      mockRedisClient.smembers.mockResolvedValueOnce([]);
      await service.registerSocket(socketId1, userId);

      // Simulate second connection
      mockRedisClient.smembers.mockResolvedValueOnce([socketId1]);
      await service.registerSocket(socketId2, userId);

      // Verify both sockets were added
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        `user:sockets:${userId}`,
        socketId1,
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        `user:sockets:${userId}`,
        socketId2,
      );
    });

    it('should keep user online when disconnecting one of multiple devices', async () => {
      // Arrange - user has 2 sockets
      mockRedisClient.get.mockResolvedValue(userId);
      mockRedisClient.smembers.mockResolvedValue([socketId2]); // Still has socket2

      // Act
      const result = await service.unregisterSocket(socketId1);

      // Assert
      expect(result).toBeNull(); // Should not return userId (not went offline)
      expect(mockRedisClient.srem).not.toHaveBeenCalledWith(
        'online:users',
        userId,
      );
    });
  });
});
