import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { GatewayService } from '../gateway.service.js';
import { AppGateway } from '../gateway.gateway.js';
import { UserActivity, UserFollow } from '@database/index.js';
import { AuthenticatedSocket, SocketUser } from '../interfaces/authenticated-socket.interface.js';

/**
 * Online Status Tests
 *
 * These tests verify the online/offline status tracking functionality
 * including multi-device support, last seen timestamps, and broadcasts.
 */
describe('Online Status', () => {
  let gatewayService: GatewayService;
  let appGateway: AppGateway;
  let mockRedisService: Record<string, Mock>;
  let mockRedisClient: Record<string, Mock>;
  let mockUserActivityRepo: Record<string, Mock>;
  let mockUserFollowRepo: Record<string, Mock>;
  let mockJwtService: Record<string, Mock>;
  let mockConfigService: Record<string, Mock>;
  let mockServer: Partial<Server>;

  const userId1 = 'user-uuid-1234';
  const userId2 = 'user-uuid-5678';
  const userId3 = 'user-uuid-9012';
  const socketId1 = 'socket-1';
  const socketId2 = 'socket-2';

  const mockUser: SocketUser = {
    id: userId1,
    email: 'test@example.com',
    username: 'testuser',
  };

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
      pipeline: vi.fn().mockReturnValue({
        sismember: vi.fn().mockReturnThis(),
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }),
    };

    mockRedisService = {
      getClient: vi.fn().mockReturnValue(mockRedisClient),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
    };

    mockUserActivityRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      insert: vi.fn().mockResolvedValue({ identifiers: [{ userId: userId1 }] }),
      upsert: vi.fn().mockResolvedValue(undefined),
      increment: vi.fn().mockResolvedValue({ affected: 1 }),
      decrement: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    mockUserFollowRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockJwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: userId1,
        email: mockUser.email,
        username: mockUser.username,
        type: 'access',
      }),
    };

    mockConfigService = {
      get: vi.fn().mockReturnValue('test-jwt-secret'),
    };

    const emitMock = vi.fn();
    mockServer = {
      adapter: vi.fn(),
      to: vi.fn().mockReturnValue({ emit: emitMock }),
      emit: emitMock,
      sockets: {
        sockets: new Map(),
        adapter: {
          rooms: new Map(),
        },
      } as any,
    };

    gatewayService = new GatewayService(
      mockRedisService as any,
      mockUserActivityRepo as any,
      mockUserFollowRepo as any,
    );

    gatewayService.setServer(mockServer as Server);

    appGateway = new AppGateway(
      gatewayService,
      mockJwtService as any,
      mockConfigService as any,
      mockRedisService as any,
    );

    (appGateway as any).server = mockServer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Online Status Updates on Connect', () => {
    it('should mark user as online when first device connects', async () => {
      // Arrange
      mockRedisClient.smembers.mockResolvedValue([]); // No existing connections

      // Act
      await gatewayService.registerSocket(socketId1, userId1);

      // Assert
      expect(mockRedisClient.sadd).toHaveBeenCalledWith('online:users', userId1);
      expect(mockUserActivityRepo.insert).toHaveBeenCalled();
    });

    it('should add to online set in Redis on connect', async () => {
      // Arrange
      mockRedisClient.smembers.mockResolvedValue([]);

      // Act
      await gatewayService.setUserOnline(userId1);

      // Assert
      expect(mockRedisClient.sadd).toHaveBeenCalledWith('online:users', userId1);
    });

    it('should update user activity in database on first connect', async () => {
      // Arrange
      mockRedisClient.smembers.mockResolvedValue([]);
      mockUserActivityRepo.findOne.mockResolvedValue(null);

      // Act
      await gatewayService.registerSocket(socketId1, userId1);

      // Assert
      expect(mockUserActivityRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: userId1,
          isOnline: true,
          activeConnections: 1,
        }),
      );
    });

    it('should increment connection count for additional devices', async () => {
      // Arrange - User already has one connection
      mockRedisClient.smembers.mockResolvedValue([socketId1]);

      // Act
      await gatewayService.registerSocket(socketId2, userId1);

      // Assert
      expect(mockUserActivityRepo.increment).toHaveBeenCalledWith(
        { userId: userId1 },
        'activeConnections',
        1,
      );
    });

    it('should not duplicate online status for multi-device user', async () => {
      // Arrange - First connection
      mockRedisClient.smembers.mockResolvedValueOnce([]);
      await gatewayService.registerSocket(socketId1, userId1);

      // Clear mocks
      vi.clearAllMocks();

      // Arrange - Second connection
      mockRedisClient.smembers.mockResolvedValueOnce([socketId1]);

      // Act
      await gatewayService.registerSocket(socketId2, userId1);

      // Assert - Should not insert new activity record
      expect(mockUserActivityRepo.insert).not.toHaveBeenCalled();
      expect(mockUserActivityRepo.increment).toHaveBeenCalled();
    });
  });

  describe('Offline Status Updates on Disconnect', () => {
    it('should mark user as offline when last device disconnects', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(userId1);
      mockRedisClient.smembers.mockResolvedValue([]); // No remaining connections

      // Act
      const result = await gatewayService.unregisterSocket(socketId1);

      // Assert
      expect(result).toBe(userId1);
      expect(mockRedisClient.srem).toHaveBeenCalledWith('online:users', userId1);
    });

    it('should remove from online set in Redis on last disconnect', async () => {
      // Act
      await gatewayService.setUserOffline(userId1);

      // Assert
      expect(mockRedisClient.srem).toHaveBeenCalledWith('online:users', userId1);
    });

    it('should update database when going offline', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(userId1);
      mockRedisClient.smembers.mockResolvedValue([]);
      mockUserActivityRepo.findOne.mockResolvedValue({ userId: userId1, isOnline: true });

      // Act
      await gatewayService.unregisterSocket(socketId1);

      // Assert
      expect(mockUserActivityRepo.update).toHaveBeenCalledWith(
        userId1,
        expect.objectContaining({
          isOnline: false,
        }),
      );
    });

    it('should keep user online when other devices still connected', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(userId1);
      mockRedisClient.smembers.mockResolvedValue([socketId2]); // Still has another connection

      // Act
      const result = await gatewayService.unregisterSocket(socketId1);

      // Assert
      expect(result).toBeNull(); // Not went offline
      expect(mockRedisClient.srem).not.toHaveBeenCalledWith('online:users', userId1);
    });

    it('should decrement connection count when one device disconnects', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(userId1);
      mockRedisClient.smembers.mockResolvedValue([socketId2]);

      // Act
      await gatewayService.unregisterSocket(socketId1);

      // Assert
      expect(mockUserActivityRepo.decrement).toHaveBeenCalledWith(
        { userId: userId1 },
        'activeConnections',
        1,
      );
    });
  });

  describe('Last Seen Timestamp', () => {
    it('should update last seen timestamp on connect', async () => {
      // Arrange
      mockRedisClient.smembers.mockResolvedValue([]);

      // Act
      await gatewayService.registerSocket(socketId1, userId1);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `user:lastseen:${userId1}`,
        expect.any(String),
      );
    });

    it('should update last seen timestamp on disconnect', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(userId1);
      mockRedisClient.smembers.mockResolvedValue([]);

      // Act
      await gatewayService.unregisterSocket(socketId1);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `user:lastseen:${userId1}`,
        expect.any(String),
      );
    });

    it('should return last seen from Redis when available', async () => {
      // Arrange
      const timestamp = Date.now().toString();
      mockRedisService.get.mockResolvedValue(timestamp);

      // Act
      const result = await gatewayService.getLastSeen(userId1);

      // Assert
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(parseInt(timestamp, 10));
    });

    it('should fallback to database when Redis has no last seen', async () => {
      // Arrange
      const dbLastSeen = new Date('2024-01-15T10:00:00Z');
      mockRedisService.get.mockResolvedValue(null);
      mockUserActivityRepo.findOne.mockResolvedValue({
        userId: userId1,
        lastSeenAt: dbLastSeen,
      });

      // Act
      const result = await gatewayService.getLastSeen(userId1);

      // Assert
      expect(result).toEqual(dbLastSeen);
    });

    it('should return null if no last seen data exists', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      mockUserActivityRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await gatewayService.getLastSeen(userId1);

      // Assert
      expect(result).toBeNull();
    });

    it('should include last seen in online status response', async () => {
      // Arrange
      const timestamp = Date.now();
      mockRedisClient.sismember.mockResolvedValue(0); // Offline
      mockRedisClient.get
        .mockResolvedValueOnce(null) // appear offline
        .mockResolvedValueOnce(timestamp.toString()); // last seen

      // Act
      const result = await gatewayService.getOnlineStatus(userId1);

      // Assert
      expect(result.lastSeen).toBeInstanceOf(Date);
      expect(result.lastSeen?.getTime()).toBe(timestamp);
    });
  });

  describe('Batch Online Status Check', () => {
    it('should return online status for multiple users', async () => {
      // Arrange
      const userIds = [userId1, userId2, userId3];
      mockRedisClient.pipeline.mockReturnValue({
        sismember: vi.fn().mockReturnThis(),
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1], // userId1 online
          [null, null], // userId1 not appear offline
          [null, Date.now().toString()], // userId1 last seen
          [null, 0], // userId2 offline
          [null, null], // userId2 not appear offline
          [null, (Date.now() - 3600000).toString()], // userId2 last seen (1 hour ago)
          [null, 1], // userId3 online
          [null, '1'], // userId3 appear offline
          [null, Date.now().toString()], // userId3 last seen
        ]),
      });

      // Act
      const result = await gatewayService.getOnlineStatusBatch(userIds);

      // Assert
      expect(result.size).toBe(3);
      expect(result.get(userId1)?.isOnline).toBe(true);
      expect(result.get(userId2)?.isOnline).toBe(false);
      expect(result.get(userId3)?.isOnline).toBe(false); // Appear offline = not visibly online
    });

    it('should return empty map for empty user list', async () => {
      // Act
      const result = await gatewayService.getOnlineStatusBatch([]);

      // Assert
      expect(result.size).toBe(0);
    });

    it('should include last seen for each user', async () => {
      // Arrange
      const now = Date.now();
      mockRedisClient.pipeline.mockReturnValue({
        sismember: vi.fn().mockReturnThis(),
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0], // offline
          [null, null], // not appear offline
          [null, now.toString()], // last seen
        ]),
      });

      // Act
      const result = await gatewayService.getOnlineStatusBatch([userId1]);

      // Assert
      expect(result.get(userId1)?.lastSeen).toBeInstanceOf(Date);
    });

    it('should respect appear offline setting in batch check', async () => {
      // Arrange
      mockRedisClient.pipeline.mockReturnValue({
        sismember: vi.fn().mockReturnThis(),
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1], // Online in Redis
          [null, '1'], // Appear offline enabled
          [null, Date.now().toString()],
        ]),
      });

      // Act
      const result = await gatewayService.getOnlineStatusBatch([userId1]);

      // Assert
      expect(result.get(userId1)?.isOnline).toBe(false);
      expect(result.get(userId1)?.appearOffline).toBe(true);
    });

    it('should use pipeline for efficient batch query', async () => {
      // Arrange
      const pipelineMock = {
        sismember: vi.fn().mockReturnThis(),
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1], [null, null], [null, Date.now().toString()],
          [null, 0], [null, null], [null, Date.now().toString()],
        ]),
      };
      mockRedisClient.pipeline.mockReturnValue(pipelineMock);

      // Act
      await gatewayService.getOnlineStatusBatch([userId1, userId2]);

      // Assert
      expect(mockRedisClient.pipeline).toHaveBeenCalledTimes(1);
      expect(pipelineMock.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('Status Broadcast to Relevant Users', () => {
    it('should broadcast online status to followers only', async () => {
      // Arrange
      const followers = [
        { followerId: 'follower-1' },
        { followerId: 'follower-2' },
        { followerId: 'follower-3' },
      ];
      mockUserFollowRepo.find.mockResolvedValue(followers);

      // Act
      await gatewayService.setUserOnline(userId1);

      // Assert
      expect(mockUserFollowRepo.find).toHaveBeenCalledWith({
        where: { followingId: userId1 },
        select: ['followerId'],
      });
      expect(mockServer.to).toHaveBeenCalledWith('user:follower-1');
      expect(mockServer.to).toHaveBeenCalledWith('user:follower-2');
      expect(mockServer.to).toHaveBeenCalledWith('user:follower-3');
    });

    it('should broadcast offline status to followers', async () => {
      // Arrange
      const followers = [{ followerId: 'follower-1' }];
      mockUserFollowRepo.find.mockResolvedValue(followers);

      // Act
      await gatewayService.setUserOffline(userId1);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('user:follower-1');
    });

    it('should not broadcast to non-followers', async () => {
      // Arrange
      mockUserFollowRepo.find.mockResolvedValue([]); // No followers

      // Act
      await gatewayService.setUserOnline(userId1);

      // Assert
      // Should not emit to random users, only through follower rooms
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should emit correct event type for online', async () => {
      // Arrange
      const followers = [{ followerId: 'follower-1' }];
      mockUserFollowRepo.find.mockResolvedValue(followers);
      const emitMock = vi.fn();
      (mockServer.to as Mock).mockReturnValue({ emit: emitMock });

      // Act
      await gatewayService.setUserOnline(userId1);

      // Assert
      expect(emitMock).toHaveBeenCalledWith('user:online', userId1);
    });

    it('should emit correct event type for offline', async () => {
      // Arrange
      const followers = [{ followerId: 'follower-1' }];
      mockUserFollowRepo.find.mockResolvedValue(followers);
      const emitMock = vi.fn();
      (mockServer.to as Mock).mockReturnValue({ emit: emitMock });

      // Act
      await gatewayService.setUserOffline(userId1);

      // Assert
      expect(emitMock).toHaveBeenCalledWith('user:offline', userId1);
    });

    it('should broadcast when appear offline is toggled', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1); // User is online
      const followers = [{ followerId: 'follower-1' }];
      mockUserFollowRepo.find.mockResolvedValue(followers);
      const emitMock = vi.fn();
      (mockServer.to as Mock).mockReturnValue({ emit: emitMock });

      // Act - Enable appear offline
      await gatewayService.setAppearOffline(userId1, true);

      // Assert - Should broadcast as offline
      expect(emitMock).toHaveBeenCalledWith('user:offline', userId1);
    });

    it('should handle broadcast errors gracefully', async () => {
      // Arrange
      mockUserFollowRepo.find.mockRejectedValue(new Error('Database error'));

      // Act & Assert - Should not throw
      await expect(
        gatewayService.setUserOnline(userId1),
      ).resolves.not.toThrow();

      // Fallback to global broadcast
      expect(mockServer.emit).toHaveBeenCalled();
    });
  });

  describe('Appear Offline Mode', () => {
    it('should hide online status when appear offline is enabled', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1); // Online
      mockRedisClient.get.mockResolvedValue('1'); // Appear offline

      // Act
      const result = await gatewayService.isUserVisiblyOnline(userId1);

      // Assert
      expect(result).toBe(false);
    });

    it('should show online status when appear offline is disabled', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1); // Online
      mockRedisClient.get.mockResolvedValue(null); // Not appear offline

      // Act
      const result = await gatewayService.isUserVisiblyOnline(userId1);

      // Assert
      expect(result).toBe(true);
    });

    it('should persist appear offline setting in database', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1);

      // Act
      await gatewayService.setAppearOffline(userId1, true);

      // Assert
      expect(mockUserActivityRepo.upsert).toHaveBeenCalledWith(
        { userId: userId1, appearOffline: true },
        ['userId'],
      );
    });

    it('should store appear offline flag in Redis', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1);
      mockUserFollowRepo.find.mockResolvedValue([]);

      // Act
      await gatewayService.setAppearOffline(userId1, true);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `user:appear_offline:${userId1}`,
        '1',
      );
    });

    it('should remove appear offline flag from Redis when disabled', async () => {
      // Arrange
      mockRedisClient.sismember.mockResolvedValue(1);
      mockUserFollowRepo.find.mockResolvedValue([]);

      // Act
      await gatewayService.setAppearOffline(userId1, false);

      // Assert
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `user:appear_offline:${userId1}`,
      );
    });
  });
});
