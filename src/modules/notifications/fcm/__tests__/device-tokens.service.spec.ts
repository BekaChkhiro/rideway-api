import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { DeviceTokensService } from '../device-tokens.service.js';
import { DeviceType } from '@database/index.js';

describe('DeviceTokensService', () => {
  let service: DeviceTokensService;
  let mockDeviceTokenRepo: Record<string, Mock>;

  const userId = 'user-uuid-1234';
  const token = 'fcm-token-123456';
  const deviceId = 'device-uuid-789';

  const mockDeviceToken = {
    id: 'dt-uuid-1234',
    userId,
    token,
    deviceType: DeviceType.IOS,
    deviceName: 'iPhone 15',
    deviceId,
    isActive: true,
    lastUsedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDeviceTokenRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([mockDeviceToken]),
      create: vi
        .fn()
        .mockImplementation((data) => ({ ...mockDeviceToken, ...data })),
      save: vi.fn().mockImplementation((data) => Promise.resolve(data)),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      count: vi.fn().mockResolvedValue(1),
    };

    service = new DeviceTokensService(mockDeviceTokenRepo as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new device token', async () => {
      // Arrange
      const dto = {
        token: 'new-token',
        deviceType: DeviceType.IOS,
        deviceName: 'iPhone 15 Pro',
      };

      // Act
      const result = await service.register(userId, dto);

      // Assert
      expect(mockDeviceTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          token: 'new-token',
          deviceType: DeviceType.IOS,
          deviceName: 'iPhone 15 Pro',
          isActive: true,
        }),
      );
      expect(mockDeviceTokenRepo.save).toHaveBeenCalled();
    });

    it('should update existing token for same user', async () => {
      // Arrange
      mockDeviceTokenRepo.findOne.mockResolvedValueOnce(mockDeviceToken);
      const dto = {
        token,
        deviceType: DeviceType.IOS,
        deviceName: 'Updated iPhone',
      };

      // Act
      const result = await service.register(userId, dto);

      // Assert
      expect(mockDeviceTokenRepo.create).not.toHaveBeenCalled();
      expect(mockDeviceTokenRepo.save).toHaveBeenCalled();
    });

    it('should deactivate token if it belongs to another user', async () => {
      // Arrange
      mockDeviceTokenRepo.findOne
        .mockResolvedValueOnce(null) // No existing token for this user
        .mockResolvedValueOnce({ ...mockDeviceToken, userId: 'other-user' }); // Token exists for another user

      const dto = {
        token: 'existing-token',
        deviceType: DeviceType.ANDROID,
      };

      // Act
      await service.register(userId, dto);

      // Assert
      expect(mockDeviceTokenRepo.update).toHaveBeenCalledWith(
        mockDeviceToken.id,
        { isActive: false },
      );
    });

    it('should deactivate old tokens for same device ID', async () => {
      // Arrange
      const dto = {
        token: 'new-token',
        deviceType: DeviceType.IOS,
        deviceId: 'device-123',
      };

      // Act
      await service.register(userId, dto);

      // Assert
      expect(mockDeviceTokenRepo.update).toHaveBeenCalledWith(
        { userId, deviceId: 'device-123', isActive: true },
        { isActive: false },
      );
    });

    it('should register Android device', async () => {
      // Arrange
      const dto = {
        token: 'android-token',
        deviceType: DeviceType.ANDROID,
        deviceName: 'Pixel 8',
      };

      // Act
      await service.register(userId, dto);

      // Assert
      expect(mockDeviceTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceType: DeviceType.ANDROID,
        }),
      );
    });

    it('should register Web device', async () => {
      // Arrange
      const dto = {
        token: 'web-push-token',
        deviceType: DeviceType.WEB,
      };

      // Act
      await service.register(userId, dto);

      // Assert
      expect(mockDeviceTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceType: DeviceType.WEB,
        }),
      );
    });
  });

  describe('unregister', () => {
    it('should deactivate device token', async () => {
      // Act
      const result = await service.unregister(userId, token);

      // Assert
      expect(result).toBe(true);
      expect(mockDeviceTokenRepo.update).toHaveBeenCalledWith(
        { userId, token },
        { isActive: false },
      );
    });

    it('should return false if token not found', async () => {
      // Arrange
      mockDeviceTokenRepo.update.mockResolvedValue({ affected: 0 });

      // Act
      const result = await service.unregister(userId, 'non-existent-token');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('unregisterAll', () => {
    it('should deactivate all tokens for user', async () => {
      // Arrange
      mockDeviceTokenRepo.update.mockResolvedValue({ affected: 3 });

      // Act
      const result = await service.unregisterAll(userId);

      // Assert
      expect(result).toBe(3);
      expect(mockDeviceTokenRepo.update).toHaveBeenCalledWith(
        { userId, isActive: true },
        { isActive: false },
      );
    });

    it('should return 0 if no tokens found', async () => {
      // Arrange
      mockDeviceTokenRepo.update.mockResolvedValue({ affected: 0 });

      // Act
      const result = await service.unregisterAll(userId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('getActiveTokens', () => {
    it('should return active tokens for user', async () => {
      // Arrange
      mockDeviceTokenRepo.find.mockResolvedValue([
        { token: 'token-1' },
        { token: 'token-2' },
      ]);

      // Act
      const result = await service.getActiveTokens(userId);

      // Assert
      expect(result).toEqual(['token-1', 'token-2']);
      expect(mockDeviceTokenRepo.find).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        select: ['token'],
      });
    });

    it('should return empty array if no active tokens', async () => {
      // Arrange
      mockDeviceTokenRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.getActiveTokens(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getUserDevices', () => {
    it('should return all devices for user', async () => {
      // Arrange
      mockDeviceTokenRepo.find.mockResolvedValue([
        mockDeviceToken,
        {
          ...mockDeviceToken,
          id: 'dt-2',
          deviceType: DeviceType.ANDROID,
          isActive: false,
        },
      ]);

      // Act
      const result = await service.getUserDevices(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('deviceType');
      expect(result[0]).toHaveProperty('isActive');
      expect(mockDeviceTokenRepo.find).toHaveBeenCalledWith({
        where: { userId },
        order: { lastUsedAt: 'DESC' },
      });
    });

    it('should map device info correctly', async () => {
      // Act
      const result = await service.getUserDevices(userId);

      // Assert
      expect(result[0]).toEqual({
        id: mockDeviceToken.id,
        deviceType: mockDeviceToken.deviceType,
        deviceName: mockDeviceToken.deviceName,
        isActive: mockDeviceToken.isActive,
        lastUsedAt: mockDeviceToken.lastUsedAt,
        createdAt: mockDeviceToken.createdAt,
      });
    });
  });

  describe('removeInvalidTokens', () => {
    it('should mark invalid tokens as inactive', async () => {
      // Arrange
      const invalidTokens = ['invalid-1', 'invalid-2'];
      mockDeviceTokenRepo.update.mockResolvedValue({ affected: 2 });

      // Act
      const result = await service.removeInvalidTokens(invalidTokens);

      // Assert
      expect(result).toBe(2);
      expect(mockDeviceTokenRepo.update).toHaveBeenCalledWith(
        { token: expect.anything() },
        { isActive: false },
      );
    });

    it('should return 0 for empty token list', async () => {
      // Act
      const result = await service.removeInvalidTokens([]);

      // Assert
      expect(result).toBe(0);
      expect(mockDeviceTokenRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteInactive', () => {
    it('should delete old inactive tokens', async () => {
      // Arrange
      mockDeviceTokenRepo.delete.mockResolvedValue({ affected: 10 });

      // Act
      const result = await service.deleteInactive(90);

      // Assert
      expect(result).toBe(10);
      expect(mockDeviceTokenRepo.delete).toHaveBeenCalledWith({
        isActive: false,
        updatedAt: expect.anything(),
      });
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      // Act
      await service.updateLastUsed(token);

      // Assert
      expect(mockDeviceTokenRepo.update).toHaveBeenCalledWith(
        { token, isActive: true },
        { lastUsedAt: expect.any(Date) },
      );
    });
  });

  describe('getActiveTokenCount', () => {
    it('should return count of active tokens', async () => {
      // Arrange
      mockDeviceTokenRepo.count.mockResolvedValue(5);

      // Act
      const result = await service.getActiveTokenCount(userId);

      // Assert
      expect(result).toBe(5);
      expect(mockDeviceTokenRepo.count).toHaveBeenCalledWith({
        where: { userId, isActive: true },
      });
    });
  });
});
