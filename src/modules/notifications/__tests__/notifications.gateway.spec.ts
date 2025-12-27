import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { NotificationsGateway } from '../notifications.gateway.js';
import { AuthenticatedSocket } from '@modules/gateway/interfaces/index.js';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let mockNotificationsService: Record<string, Mock>;
  let mockClient: Partial<AuthenticatedSocket>;

  const userId = 'user-uuid-1234';
  const notificationId = 'notification-uuid-5678';

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotificationsService = {
      getUnreadCount: vi.fn().mockResolvedValue(5),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      markAllAsRead: vi.fn().mockResolvedValue(3),
    };

    mockClient = {
      id: 'socket-123',
      user: {
        id: userId,
        email: 'test@example.com',
      } as any,
    };

    gateway = new NotificationsGateway(mockNotificationsService as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleGetUnreadCount', () => {
    it('should return unread notification count', async () => {
      const result = await gateway.handleGetUnreadCount(mockClient as AuthenticatedSocket);

      expect(result).toEqual({ unreadCount: 5 });
      expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith(userId);
    });

    it('should return zero when no unread notifications', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(0);

      const result = await gateway.handleGetUnreadCount(mockClient as AuthenticatedSocket);

      expect(result).toEqual({ unreadCount: 0 });
    });
  });

  describe('handleMarkAsRead', () => {
    it('should mark notification as read successfully', async () => {
      const result = await gateway.handleMarkAsRead(
        mockClient as AuthenticatedSocket,
        notificationId,
      );

      expect(result).toEqual({ success: true });
      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(
        notificationId,
        userId,
      );
    });

    it('should return error if marking fails', async () => {
      mockNotificationsService.markAsRead.mockRejectedValue(
        new Error('Notification not found'),
      );

      const result = await gateway.handleMarkAsRead(
        mockClient as AuthenticatedSocket,
        notificationId,
      );

      expect(result).toEqual({
        success: false,
        error: 'Notification not found',
      });
    });

    it('should return error for unauthorized notification', async () => {
      mockNotificationsService.markAsRead.mockRejectedValue(
        new Error('Not authorized to access this notification'),
      );

      const result = await gateway.handleMarkAsRead(
        mockClient as AuthenticatedSocket,
        'other-notification',
      );

      expect(result).toEqual({
        success: false,
        error: 'Not authorized to access this notification',
      });
    });
  });

  describe('handleMarkAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const result = await gateway.handleMarkAllAsRead(mockClient as AuthenticatedSocket);

      expect(result).toEqual({ success: true, markedCount: 3 });
      expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith(userId);
    });

    it('should return zero when no notifications to mark', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue(0);

      const result = await gateway.handleMarkAllAsRead(mockClient as AuthenticatedSocket);

      expect(result).toEqual({ success: true, markedCount: 0 });
    });

    it('should handle many unread notifications', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue(100);

      const result = await gateway.handleMarkAllAsRead(mockClient as AuthenticatedSocket);

      expect(result).toEqual({ success: true, markedCount: 100 });
    });
  });
});
