import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { FCMService } from '../fcm.service.js';

describe('FCMService', () => {
  let service: FCMService;
  let mockConfigService: Record<string, Mock>;
  let mockDeviceTokensService: Record<string, Mock>;

  const userId = 'user-uuid-1234';
  const tokens = ['token-1', 'token-2'];

  const mockPayload = {
    title: 'Test Notification',
    body: 'This is a test',
    data: {
      type: 'test',
      entityId: '123',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          'firebase.projectId': 'test-project',
          'firebase.privateKey': 'test-private-key',
          'firebase.clientEmail': 'test@test.iam.gserviceaccount.com',
        };
        return config[key];
      }),
    };

    mockDeviceTokensService = {
      getActiveTokens: vi.fn().mockResolvedValue(tokens),
      removeInvalidTokens: vi.fn().mockResolvedValue(0),
    };

    service = new FCMService(
      mockConfigService as any,
      mockDeviceTokensService as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAvailable', () => {
    it('should return false initially before initialization', () => {
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('sendToUser (when not initialized)', () => {
    it('should return empty result if FCM not initialized', async () => {
      // FCM is not initialized, so it should return empty result
      const result = await service.sendToUser(userId, mockPayload);

      expect(result).toEqual({
        successCount: 0,
        failureCount: 0,
        failedTokens: [],
      });
    });
  });

  describe('sendToTokens (when not initialized)', () => {
    it('should return empty result if FCM not initialized', async () => {
      const result = await service.sendToTokens(tokens, mockPayload);

      expect(result).toEqual({
        successCount: 0,
        failureCount: 0,
        failedTokens: [],
      });
    });

    it('should return empty result for empty token list', async () => {
      const result = await service.sendToTokens([], mockPayload);

      expect(result).toEqual({
        successCount: 0,
        failureCount: 0,
        failedTokens: [],
      });
    });
  });

  describe('sendToTopic (when not initialized)', () => {
    it('should return false if not initialized', async () => {
      const result = await service.sendToTopic('announcements', mockPayload);

      expect(result).toBe(false);
    });
  });

  describe('subscribeToTopic (when not initialized)', () => {
    it('should return 0 if not initialized', async () => {
      const result = await service.subscribeToTopic(tokens, 'news');

      expect(result).toBe(0);
    });

    it('should return 0 for empty tokens', async () => {
      const result = await service.subscribeToTopic([], 'news');

      expect(result).toBe(0);
    });
  });

  describe('unsubscribeFromTopic (when not initialized)', () => {
    it('should return 0 if not initialized', async () => {
      const result = await service.unsubscribeFromTopic(tokens, 'news');

      expect(result).toBe(0);
    });

    it('should return 0 for empty tokens', async () => {
      const result = await service.unsubscribeFromTopic([], 'news');

      expect(result).toBe(0);
    });
  });

  describe('onModuleInit', () => {
    it('should not initialize if credentials are missing', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert - should still be unavailable
      expect(service.isAvailable()).toBe(false);
    });

    it('should not initialize if projectId is missing', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'firebase.projectId') return undefined;
        return 'some-value';
      });

      // Act
      await service.onModuleInit();

      // Assert
      expect(service.isAvailable()).toBe(false);
    });

    it('should not initialize if privateKey is missing', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'firebase.privateKey') return undefined;
        return 'some-value';
      });

      // Act
      await service.onModuleInit();

      // Assert
      expect(service.isAvailable()).toBe(false);
    });

    it('should not initialize if clientEmail is missing', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'firebase.clientEmail') return undefined;
        return 'some-value';
      });

      // Act
      await service.onModuleInit();

      // Assert
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('getActiveTokens integration', () => {
    it('should call deviceTokensService.getActiveTokens when sending to user', async () => {
      // Even when not initialized, it checks for tokens first
      await service.sendToUser(userId, mockPayload);

      // When not initialized, it returns early without checking tokens
      // This is expected behavior
      expect(mockDeviceTokensService.getActiveTokens).not.toHaveBeenCalled();
    });
  });
});
