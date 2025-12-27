import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { NotificationProcessor } from '../processors/notification.processor.js';
import { NotificationType } from '../interfaces/job-data.interface.js';
import { Job } from 'bullmq';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let mockNotificationsService: Record<string, Mock>;
  let mockGatewayService: Record<string, Mock>;

  const userId = 'user-uuid-1234';
  const senderId = 'sender-uuid-5678';
  const jobId = 'job-uuid-9999';
  const notificationId = 'notification-uuid-1111';

  const mockNotificationData = {
    type: 'new_follower' as NotificationType,
    recipientId: userId,
    senderId,
    variables: { username: 'testuser' },
  };

  const mockNotification = {
    id: notificationId,
    type: 'new_follower',
    recipientId: userId,
    senderId,
    title: 'testuser started following you',
    body: 'Tap to view their profile',
    isRead: false,
    createdAt: new Date(),
  };

  const createMockJob = (data: any, options: Partial<Job> = {}): Job => ({
    id: jobId,
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...options,
  } as unknown as Job);

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotificationsService = {
      create: vi.fn().mockResolvedValue(mockNotification),
    };

    mockGatewayService = {
      isUserOnline: vi.fn().mockResolvedValue(true),
    };

    processor = new NotificationProcessor(
      mockNotificationsService as any,
      mockGatewayService as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('process', () => {
    it('should create notification for online user', async () => {
      // Arrange
      const job = createMockJob(mockNotificationData);

      // Act
      const result = await processor.process(job);

      // Assert
      expect(result).toEqual({
        notificationId,
        pushQueued: false,
        skipped: false,
      });
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'new_follower',
          recipientId: userId,
          senderId,
        }),
        expect.objectContaining({
          skipSocketEmit: false,
          skipPushNotification: true,
        }),
      );
    });

    it('should indicate push should be queued for offline user', async () => {
      // Arrange
      mockGatewayService.isUserOnline.mockResolvedValue(false);
      const job = createMockJob(mockNotificationData);

      // Act
      const result = await processor.process(job);

      // Assert
      expect(result).toEqual({
        notificationId,
        pushQueued: true,
        skipped: false,
      });
    });

    it('should return skipped result if notification not created', async () => {
      // Arrange
      mockNotificationsService.create.mockResolvedValue(null);
      const job = createMockJob(mockNotificationData);

      // Act
      const result = await processor.process(job);

      // Assert
      expect(result).toEqual({
        skipped: true,
        pushQueued: false,
        reason: 'Notification skipped due to user preferences',
      });
      expect(mockGatewayService.isUserOnline).not.toHaveBeenCalled();
    });

    it('should pass title and body from job data', async () => {
      // Arrange
      const dataWithTitle = {
        ...mockNotificationData,
        title: 'Custom Title',
        body: 'Custom body message',
      };
      const job = createMockJob(dataWithTitle);

      // Act
      await processor.process(job);

      // Assert
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Title',
          body: 'Custom body message',
        }),
        expect.any(Object),
      );
    });

    it('should pass data object to notification', async () => {
      // Arrange
      const dataWithPayload = {
        ...mockNotificationData,
        data: { entityId: 'entity-123', screen: 'profile' },
      };
      const job = createMockJob(dataWithPayload);

      // Act
      await processor.process(job);

      // Assert
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { entityId: 'entity-123', screen: 'profile' },
        }),
        expect.any(Object),
      );
    });

    it('should throw error on notification service failure', async () => {
      // Arrange
      mockNotificationsService.create.mockRejectedValue(new Error('DB error'));
      const job = createMockJob(mockNotificationData);

      // Act & Assert
      await expect(processor.process(job)).rejects.toThrow('DB error');
    });

    it('should process post_like notification type', async () => {
      // Arrange
      const job = createMockJob({
        type: 'post_like' as NotificationType,
        recipientId: userId,
        senderId,
        variables: { username: 'liker', postTitle: 'My Post' },
      });

      // Act
      const result = await processor.process(job);

      // Assert
      expect(result.skipped).toBe(false);
      expect(mockNotificationsService.create).toHaveBeenCalled();
    });

    it('should process post_comment notification type', async () => {
      // Arrange
      const job = createMockJob({
        type: 'post_comment' as NotificationType,
        recipientId: userId,
        senderId,
        variables: { username: 'commenter' },
      });

      // Act
      const result = await processor.process(job);

      // Assert
      expect(result.skipped).toBe(false);
    });
  });

  describe('onCompleted', () => {
    it('should log completion', () => {
      // Arrange
      const job = createMockJob(mockNotificationData);

      // Act - should not throw
      expect(() => processor.onCompleted(job)).not.toThrow();
    });
  });

  describe('onFailed', () => {
    it('should log failure with error message', () => {
      // Arrange
      const job = createMockJob(mockNotificationData);
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      // Act - should not throw
      expect(() => processor.onFailed(job, error)).not.toThrow();
    });
  });
});
