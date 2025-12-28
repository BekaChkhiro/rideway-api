import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { NotificationsController } from '../notifications.controller.js';
import { NotificationsService } from '../notifications.service.js';
import { DeviceTokensService } from '../fcm/index.js';
import { NotificationType } from '../constants/notification-types.constant.js';
import { User, DeviceType } from '@database/index.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockNotificationsService: Record<string, Mock>;
  let mockDeviceTokensService: Record<string, Mock>;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
  };

  const notificationId = 'notification-uuid-1234';

  const mockNotificationResponse = {
    id: notificationId,
    type: NotificationType.NEW_FOLLOWER,
    title: 'testuser started following you',
    body: 'Tap to view their profile',
    isRead: false,
    createdAt: new Date(),
  };

  const mockPreferences = {
    pushEnabled: true,
    emailEnabled: true,
    newFollower: true,
    postLike: true,
    postComment: true,
    commentReply: true,
    newMessage: true,
    threadReply: true,
    listingInquiry: true,
  };

  const mockDevice = {
    id: 'device-uuid-1234',
    userId: mockUser.id,
    token: 'fcm-token-123',
    deviceType: DeviceType.IOS,
    deviceName: 'iPhone 15',
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotificationsService = {
      findAll: vi.fn().mockResolvedValue({
        notifications: [mockNotificationResponse],
        total: 1,
        unreadCount: 1,
        hasMore: false,
      }),
      findOne: vi.fn().mockResolvedValue(mockNotificationResponse),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      markAllAsRead: vi.fn().mockResolvedValue(5),
      getUnreadCount: vi.fn().mockResolvedValue(5),
      getPreferences: vi.fn().mockResolvedValue(mockPreferences),
      updatePreferences: vi.fn().mockResolvedValue(mockPreferences),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    mockDeviceTokensService = {
      getUserDevices: vi.fn().mockResolvedValue([mockDevice]),
      register: vi.fn().mockResolvedValue(mockDevice),
      unregister: vi.fn().mockResolvedValue(undefined),
      unregisterAll: vi.fn().mockResolvedValue(undefined),
    };

    controller = new NotificationsController(
      mockNotificationsService as any,
      mockDeviceTokensService as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNotifications', () => {
    it('should return paginated notifications for user', async () => {
      // Act
      const result = await controller.getNotifications(mockUser as User, {});

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        {},
      );
    });

    it('should pass query params to service', async () => {
      // Arrange
      const query = { limit: 10, offset: 5, unreadOnly: true };

      // Act
      await controller.getNotifications(mockUser as User, query);

      // Assert
      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
    });

    it('should filter by notification type', async () => {
      // Arrange
      const query = { type: NotificationType.NEW_FOLLOWER };

      // Act
      await controller.getNotifications(mockUser as User, query);

      // Assert
      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      // Act
      const result = await controller.getUnreadCount(mockUser as User);

      // Assert
      expect(result).toEqual({ unreadCount: 5 });
      expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('getNotification', () => {
    it('should return single notification by id', async () => {
      // Act
      const result = await controller.getNotification(
        mockUser as User,
        notificationId,
      );

      // Assert
      expect(result.id).toBe(notificationId);
      expect(mockNotificationsService.findOne).toHaveBeenCalledWith(
        notificationId,
        mockUser.id,
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // Act
      await controller.markAsRead(mockUser as User, notificationId);

      // Assert
      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(
        notificationId,
        mockUser.id,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read and return count', async () => {
      // Act
      const result = await controller.markAllAsRead(mockUser as User);

      // Assert
      expect(result).toEqual({ markedCount: 5 });
      expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      // Act
      await controller.deleteNotification(mockUser as User, notificationId);

      // Assert
      expect(mockNotificationsService.delete).toHaveBeenCalledWith(
        notificationId,
        mockUser.id,
      );
    });
  });

  describe('Preferences', () => {
    describe('getPreferences', () => {
      it('should return notification preferences', async () => {
        // Act
        const result = await controller.getPreferences(mockUser as User);

        // Assert
        expect(result.pushEnabled).toBe(true);
        expect(result.newFollower).toBe(true);
        expect(result.postLike).toBe(true);
        expect(mockNotificationsService.getPreferences).toHaveBeenCalledWith(
          mockUser.id,
        );
      });
    });

    describe('updatePreferences', () => {
      it('should update notification preferences', async () => {
        // Arrange
        const updateDto = { postLike: false, newFollower: false };
        mockNotificationsService.updatePreferences.mockResolvedValue({
          ...mockPreferences,
          ...updateDto,
        });

        // Act
        const result = await controller.updatePreferences(
          mockUser as User,
          updateDto,
        );

        // Assert
        expect(result.postLike).toBe(false);
        expect(result.newFollower).toBe(false);
        expect(mockNotificationsService.updatePreferences).toHaveBeenCalledWith(
          mockUser.id,
          updateDto,
        );
      });

      it('should disable push notifications globally', async () => {
        // Arrange
        const updateDto = { pushEnabled: false };
        mockNotificationsService.updatePreferences.mockResolvedValue({
          ...mockPreferences,
          pushEnabled: false,
        });

        // Act
        const result = await controller.updatePreferences(
          mockUser as User,
          updateDto,
        );

        // Assert
        expect(result.pushEnabled).toBe(false);
      });
    });
  });

  describe('Device Token Endpoints', () => {
    describe('getDevices', () => {
      it('should return list of registered devices', async () => {
        // Act
        const result = await controller.getDevices(mockUser as User);

        // Assert
        expect(result.devices).toHaveLength(1);
        expect(result.devices[0].deviceType).toBe(DeviceType.IOS);
        expect(mockDeviceTokensService.getUserDevices).toHaveBeenCalledWith(
          mockUser.id,
        );
      });

      it('should return empty array if no devices registered', async () => {
        // Arrange
        mockDeviceTokensService.getUserDevices.mockResolvedValue([]);

        // Act
        const result = await controller.getDevices(mockUser as User);

        // Assert
        expect(result.devices).toHaveLength(0);
      });
    });

    describe('registerDevice', () => {
      it('should register new device for push notifications', async () => {
        // Arrange
        const registerDto = {
          token: 'new-fcm-token',
          deviceType: DeviceType.ANDROID,
          deviceName: 'Pixel 8',
        };

        const newDevice = {
          id: 'new-device-id',
          ...registerDto,
          userId: mockUser.id,
          isActive: true,
        };

        mockDeviceTokensService.register.mockResolvedValue(newDevice);

        // Act
        const result = await controller.registerDevice(
          mockUser as User,
          registerDto,
        );

        // Assert
        expect(result.id).toBe('new-device-id');
        expect(result.deviceType).toBe(DeviceType.ANDROID);
        expect(mockDeviceTokensService.register).toHaveBeenCalledWith(
          mockUser.id,
          registerDto,
        );
      });

      it('should register iOS device', async () => {
        // Arrange
        const registerDto = {
          token: 'apns-token',
          deviceType: DeviceType.IOS,
          deviceName: 'iPhone 15 Pro',
        };

        mockDeviceTokensService.register.mockResolvedValue({
          id: 'ios-device-id',
          ...registerDto,
          userId: mockUser.id,
          isActive: true,
        });

        // Act
        const result = await controller.registerDevice(
          mockUser as User,
          registerDto,
        );

        // Assert
        expect(result.deviceType).toBe(DeviceType.IOS);
      });

      it('should register web device', async () => {
        // Arrange
        const registerDto = {
          token: 'web-push-token',
          deviceType: DeviceType.WEB,
        };

        mockDeviceTokensService.register.mockResolvedValue({
          id: 'web-device-id',
          ...registerDto,
          userId: mockUser.id,
          isActive: true,
        });

        // Act
        const result = await controller.registerDevice(
          mockUser as User,
          registerDto,
        );

        // Assert
        expect(result.deviceType).toBe(DeviceType.WEB);
      });
    });

    describe('unregisterDevice', () => {
      it('should unregister device by token', async () => {
        // Arrange
        const token = 'fcm-token-to-remove';

        // Act
        await controller.unregisterDevice(mockUser as User, token);

        // Assert
        expect(mockDeviceTokensService.unregister).toHaveBeenCalledWith(
          mockUser.id,
          token,
        );
      });
    });

    describe('unregisterAllDevices', () => {
      it('should unregister all devices for user', async () => {
        // Act
        await controller.unregisterAllDevices(mockUser as User);

        // Assert
        expect(mockDeviceTokensService.unregisterAll).toHaveBeenCalledWith(
          mockUser.id,
        );
      });
    });
  });
});
