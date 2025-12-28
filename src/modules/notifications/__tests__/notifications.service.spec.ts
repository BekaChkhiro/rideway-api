import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../notifications.service.js';
import {
  NotificationType,
  NotificationTemplates,
} from '../constants/notification-types.constant.js';
import { Notification, NotificationPreferences } from '../entities/index.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockNotificationRepo: Record<string, Mock>;
  let mockPreferencesRepo: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;
  let mockGatewayService: Record<string, Mock>;
  let mockQueueService: Record<string, Mock>;

  const userId = 'user-uuid-1234';
  const senderId = 'sender-uuid-5678';
  const notificationId = 'notification-uuid-1234';

  const mockNotification: Partial<Notification> = {
    id: notificationId,
    userId,
    type: NotificationType.NEW_FOLLOWER,
    title: 'testuser started following you',
    body: 'Tap to view their profile',
    data: { entityType: 'user', entityId: senderId },
    isRead: false,
    senderId,
    createdAt: new Date(),
  };

  const mockPreferences: Partial<NotificationPreferences> = {
    id: 'pref-uuid',
    userId,
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

  beforeEach(() => {
    vi.resetAllMocks();

    mockNotificationRepo = {
      create: vi
        .fn()
        .mockImplementation((data) => ({ ...mockNotification, ...data })),
      save: vi
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ ...data, id: notificationId }),
        ),
      findOne: vi.fn().mockResolvedValue(mockNotification),
      findAndCount: vi.fn().mockResolvedValue([[mockNotification], 1]),
      count: vi.fn().mockResolvedValue(5),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    mockPreferencesRepo = {
      findOne: vi.fn().mockResolvedValue(mockPreferences),
      create: vi
        .fn()
        .mockImplementation((data) => ({ ...mockPreferences, ...data })),
      save: vi.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    mockRedisService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };

    mockGatewayService = {
      isUserOnline: vi.fn().mockResolvedValue(false),
      emitToUser: vi.fn(),
    };

    mockQueueService = {
      addPushJob: vi.fn().mockResolvedValue(undefined),
    };

    service = new NotificationsService(
      mockNotificationRepo as any,
      mockPreferencesRepo as any,
      mockRedisService as any,
      mockGatewayService as any,
      mockQueueService as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('should create notification with template interpolation', async () => {
      // Arrange
      const payload = {
        type: NotificationType.NEW_FOLLOWER,
        recipientId: userId,
        senderId,
        variables: { username: 'testuser' },
        data: { entityType: 'user', entityId: senderId },
      };

      // Act
      const result = await service.create(payload);

      // Assert
      expect(result).not.toBeNull();
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: NotificationType.NEW_FOLLOWER,
          title: 'testuser started following you',
          senderId,
        }),
      );
      expect(mockNotificationRepo.save).toHaveBeenCalled();
    });

    it('should skip notification if user preferences are disabled', async () => {
      // Arrange
      mockPreferencesRepo.findOne.mockResolvedValue({
        ...mockPreferences,
        newFollower: false,
      });

      // Act
      const result = await service.create({
        type: NotificationType.NEW_FOLLOWER,
        recipientId: userId,
        senderId,
        variables: { username: 'testuser' },
      });

      // Assert
      expect(result).toBeNull();
      expect(mockNotificationRepo.save).not.toHaveBeenCalled();
    });

    it('should skip notification if push is globally disabled', async () => {
      // Arrange
      mockPreferencesRepo.findOne.mockResolvedValue({
        ...mockPreferences,
        pushEnabled: false,
      });

      // Act
      const result = await service.create({
        type: NotificationType.NEW_FOLLOWER,
        recipientId: userId,
        senderId,
        variables: { username: 'testuser' },
      });

      // Assert
      expect(result).toBeNull();
    });

    it('should force create notification when skipPreferenceCheck is true', async () => {
      // Arrange
      mockPreferencesRepo.findOne.mockResolvedValue({
        ...mockPreferences,
        pushEnabled: false,
      });

      // Act
      const result = await service.create(
        {
          type: NotificationType.NEW_FOLLOWER,
          recipientId: userId,
          senderId,
          variables: { username: 'testuser' },
        },
        { skipPreferenceCheck: true },
      );

      // Assert
      expect(result).not.toBeNull();
      expect(mockNotificationRepo.save).toHaveBeenCalled();
    });

    it('should emit socket notification for online users', async () => {
      // Arrange
      mockGatewayService.isUserOnline.mockResolvedValue(true);
      mockNotificationRepo.findOne.mockResolvedValue(mockNotification);

      // Act
      await service.create({
        type: NotificationType.NEW_FOLLOWER,
        recipientId: userId,
        senderId,
        variables: { username: 'testuser' },
      });

      // Assert
      expect(mockGatewayService.emitToUser).toHaveBeenCalledWith(
        userId,
        'notification:new',
        expect.objectContaining({
          id: notificationId,
          type: NotificationType.NEW_FOLLOWER,
        }),
      );
    });

    it('should queue push notification for offline users', async () => {
      // Arrange
      mockGatewayService.isUserOnline.mockResolvedValue(false);

      // Act
      await service.create({
        type: NotificationType.NEW_FOLLOWER,
        recipientId: userId,
        senderId,
        variables: { username: 'testuser' },
        data: {
          entityType: 'user',
          entityId: senderId,
          deepLink: '/users/123',
        },
      });

      // Assert
      expect(mockQueueService.addPushJob).toHaveBeenCalledWith({
        userId,
        title: expect.any(String),
        body: expect.any(String),
        data: expect.objectContaining({
          notificationId,
          type: NotificationType.NEW_FOLLOWER,
        }),
      });
    });

    it('should not queue push notification when skipPushNotification is true', async () => {
      // Arrange
      mockGatewayService.isUserOnline.mockResolvedValue(false);

      // Act
      await service.create(
        {
          type: NotificationType.NEW_FOLLOWER,
          recipientId: userId,
          senderId,
          variables: { username: 'testuser' },
        },
        { skipPushNotification: true },
      );

      // Assert
      expect(mockQueueService.addPushJob).not.toHaveBeenCalled();
    });

    it('should invalidate unread count cache after creating notification', async () => {
      // Act
      await service.create({
        type: NotificationType.NEW_FOLLOWER,
        recipientId: userId,
        senderId,
        variables: { username: 'testuser' },
      });

      // Assert
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `notification:unread:${userId}`,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      // Arrange
      mockNotificationRepo.findAndCount.mockResolvedValue([
        [mockNotification],
        1,
      ]);

      // Act
      const result = await service.findAll(userId, { limit: 20, offset: 0 });

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mockNotificationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          take: 21, // limit + 1 to check hasMore
          skip: 0,
        }),
      );
    });

    it('should filter by unread only', async () => {
      // Act
      await service.findAll(userId, { unreadOnly: true });

      // Assert
      expect(mockNotificationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, isRead: false },
        }),
      );
    });

    it('should filter by notification type', async () => {
      // Act
      await service.findAll(userId, { type: NotificationType.NEW_FOLLOWER });

      // Assert
      expect(mockNotificationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, type: NotificationType.NEW_FOLLOWER },
        }),
      );
    });

    it('should correctly indicate hasMore when more results exist', async () => {
      // Arrange - Return 21 items (limit + 1)
      const notifications = Array(21)
        .fill(null)
        .map((_, i) => ({ ...mockNotification, id: `notif-${i}` }));
      mockNotificationRepo.findAndCount.mockResolvedValue([notifications, 100]);

      // Act
      const result = await service.findAll(userId, { limit: 20 });

      // Assert
      expect(result.notifications).toHaveLength(20); // Pop'd the extra
      expect(result.hasMore).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return notification by id', async () => {
      // Act
      const result = await service.findOne(notificationId, userId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(notificationId);
      expect(mockNotificationRepo.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, userId },
        relations: ['sender', 'sender.profile'],
      });
    });

    it('should throw NotFoundException if notification not found', async () => {
      // Arrange
      mockNotificationRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('unknown-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // Arrange
      mockNotificationRepo.findOne.mockResolvedValue({
        ...mockNotification,
        isRead: false,
      });

      // Act
      await service.markAsRead(notificationId, userId);

      // Assert
      expect(mockNotificationRepo.update).toHaveBeenCalledWith(notificationId, {
        isRead: true,
        readAt: expect.any(Date),
      });
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `notification:unread:${userId}`,
      );
    });

    it('should throw NotFoundException if notification not found', async () => {
      // Arrange
      mockNotificationRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.markAsRead('unknown-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if notification belongs to another user', async () => {
      // Arrange
      mockNotificationRepo.findOne.mockResolvedValue({
        ...mockNotification,
        userId: 'other-user',
      });

      // Act & Assert
      await expect(service.markAsRead(notificationId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should not update if notification already read', async () => {
      // Arrange
      mockNotificationRepo.findOne.mockResolvedValue({
        ...mockNotification,
        isRead: true,
      });

      // Act
      await service.markAsRead(notificationId, userId);

      // Assert
      expect(mockNotificationRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      // Arrange
      mockNotificationRepo.update.mockResolvedValue({ affected: 5 });

      // Act
      const result = await service.markAllAsRead(userId);

      // Assert
      expect(result).toBe(5);
      expect(mockNotificationRepo.update).toHaveBeenCalledWith(
        { userId, isRead: false },
        { isRead: true, readAt: expect.any(Date) },
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `notification:unread:${userId}`,
      );
    });

    it('should return 0 if no unread notifications', async () => {
      // Arrange
      mockNotificationRepo.update.mockResolvedValue({ affected: 0 });

      // Act
      const result = await service.markAllAsRead(userId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('should return cached unread count', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue('10');

      // Act
      const result = await service.getUnreadCount(userId);

      // Assert
      expect(result).toBe(10);
      expect(mockNotificationRepo.count).not.toHaveBeenCalled();
    });

    it('should query database and cache result if not cached', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      mockNotificationRepo.count.mockResolvedValue(5);

      // Act
      const result = await service.getUnreadCount(userId);

      // Assert
      expect(result).toBe(5);
      expect(mockNotificationRepo.count).toHaveBeenCalledWith({
        where: { userId, isRead: false },
      });
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `notification:unread:${userId}`,
        '5',
        300,
      );
    });
  });

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      // Act
      const result = await service.getPreferences(userId);

      // Assert
      expect(result).toEqual(mockPreferences);
    });

    it('should create default preferences if none exist', async () => {
      // Arrange
      mockPreferencesRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getPreferences(userId);

      // Assert
      expect(mockPreferencesRepo.create).toHaveBeenCalledWith({ userId });
      expect(mockPreferencesRepo.save).toHaveBeenCalled();
    });
  });

  describe('updatePreferences', () => {
    it('should update existing preferences', async () => {
      // Arrange
      const updates = { postLike: false, newFollower: false };

      // Act
      const result = await service.updatePreferences(userId, updates);

      // Assert
      expect(mockPreferencesRepo.save).toHaveBeenCalled();
    });

    it('should create preferences if none exist', async () => {
      // Arrange
      mockPreferencesRepo.findOne.mockResolvedValue(null);

      // Act
      await service.updatePreferences(userId, { postLike: false });

      // Assert
      expect(mockPreferencesRepo.create).toHaveBeenCalledWith({
        userId,
        postLike: false,
      });
    });
  });

  describe('delete', () => {
    it('should delete notification', async () => {
      // Act
      await service.delete(notificationId, userId);

      // Assert
      expect(mockNotificationRepo.delete).toHaveBeenCalledWith(notificationId);
    });

    it('should throw NotFoundException if notification not found', async () => {
      // Arrange
      mockNotificationRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('unknown-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should invalidate cache if deleted notification was unread', async () => {
      // Arrange
      mockNotificationRepo.findOne.mockResolvedValue({
        ...mockNotification,
        isRead: false,
      });

      // Act
      await service.delete(notificationId, userId);

      // Assert
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `notification:unread:${userId}`,
      );
    });

    it('should not invalidate cache if deleted notification was read', async () => {
      // Arrange
      mockNotificationRepo.findOne.mockResolvedValue({
        ...mockNotification,
        isRead: true,
      });

      // Act
      await service.delete(notificationId, userId);

      // Assert
      expect(mockRedisService.del).not.toHaveBeenCalled();
    });
  });

  describe('deleteOld', () => {
    it('should delete old read notifications', async () => {
      // Arrange
      mockNotificationRepo.delete.mockResolvedValue({ affected: 100 });

      // Act
      const result = await service.deleteOld(30);

      // Assert
      expect(result).toBe(100);
      expect(mockNotificationRepo.delete).toHaveBeenCalledWith({
        createdAt: expect.any(Object), // LessThan operator
        isRead: true,
      });
    });
  });

  describe('Helper Notification Methods', () => {
    let createSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Spy on the create method and make it skip preferences check
      createSpy = vi
        .spyOn(service, 'create')
        .mockResolvedValue(mockNotification as Notification);
    });

    afterEach(() => {
      createSpy.mockRestore();
    });

    describe('notifyNewFollower', () => {
      it('should create new follower notification', async () => {
        // Act
        await service.notifyNewFollower(senderId, userId, 'testuser');

        // Assert
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: NotificationType.NEW_FOLLOWER,
            recipientId: userId,
            senderId,
            variables: { username: 'testuser' },
          }),
        );
      });
    });

    describe('notifyPostLike', () => {
      it('should create post like notification', async () => {
        // Act
        await service.notifyPostLike(
          senderId,
          userId,
          'post-123',
          'liker',
          'My post content',
        );

        // Assert
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: NotificationType.POST_LIKE,
            recipientId: userId,
            senderId,
            data: expect.objectContaining({
              entityType: 'post',
              entityId: 'post-123',
            }),
          }),
        );
      });

      it('should not notify if user likes own post', async () => {
        // Act
        await service.notifyPostLike(
          userId,
          userId,
          'post-123',
          'self',
          'My post',
        );

        // Assert
        expect(createSpy).not.toHaveBeenCalled();
      });
    });

    describe('notifyPostComment', () => {
      it('should create post comment notification', async () => {
        // Act
        await service.notifyPostComment(
          senderId,
          userId,
          'post-123',
          'comment-456',
          'commenter',
          'Nice post!',
        );

        // Assert
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: NotificationType.POST_COMMENT,
            recipientId: userId,
            senderId,
            data: expect.objectContaining({
              entityType: 'comment',
              entityId: 'comment-456',
              postId: 'post-123',
            }),
          }),
        );
      });

      it('should not notify if user comments on own post', async () => {
        // Act
        await service.notifyPostComment(
          userId,
          userId,
          'post-123',
          'comment-456',
          'self',
          'Nice!',
        );

        // Assert
        expect(createSpy).not.toHaveBeenCalled();
      });
    });

    describe('notifyCommentReply', () => {
      it('should create comment reply notification', async () => {
        // Act
        await service.notifyCommentReply(
          senderId,
          userId,
          'post-123',
          'comment-456',
          'reply-789',
          'replier',
          'Great comment!',
        );

        // Assert
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: NotificationType.COMMENT_REPLY,
            recipientId: userId,
            senderId,
            data: expect.objectContaining({
              entityType: 'comment',
              entityId: 'reply-789',
              parentCommentId: 'comment-456',
            }),
          }),
        );
      });
    });

    describe('notifyNewMessage', () => {
      it('should create new message notification', async () => {
        // Act
        await service.notifyNewMessage(
          senderId,
          userId,
          'conv-123',
          'sender',
          'Hello there!',
        );

        // Assert
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: NotificationType.NEW_MESSAGE,
            recipientId: userId,
            senderId,
            data: expect.objectContaining({
              entityType: 'conversation',
              entityId: 'conv-123',
            }),
          }),
        );
      });
    });

    describe('notifyThreadReply', () => {
      it('should create thread reply notification', async () => {
        // Act
        await service.notifyThreadReply(
          senderId,
          userId,
          'thread-123',
          'reply-456',
          'replier',
          'Good point!',
        );

        // Assert
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: NotificationType.THREAD_REPLY,
            recipientId: userId,
            senderId,
            data: expect.objectContaining({
              entityType: 'thread_reply',
              entityId: 'reply-456',
              threadId: 'thread-123',
            }),
          }),
        );
      });
    });

    describe('notifyListingInquiry', () => {
      it('should create listing inquiry notification', async () => {
        // Act
        await service.notifyListingInquiry(
          senderId,
          userId,
          'listing-123',
          'inquirer',
          'Honda CBR 600RR',
        );

        // Assert
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: NotificationType.LISTING_INQUIRY,
            recipientId: userId,
            senderId,
            data: expect.objectContaining({
              entityType: 'listing',
              entityId: 'listing-123',
            }),
          }),
        );
      });
    });
  });

  describe('Template Interpolation', () => {
    it('should correctly interpolate template variables', async () => {
      // Arrange - skip preferences check to focus on template interpolation
      const result = await service.create(
        {
          type: NotificationType.POST_LIKE,
          recipientId: userId,
          senderId,
          variables: {
            username: 'biker123',
            postPreview: 'Check out my ride!',
          },
        },
        { skipPreferenceCheck: true },
      );

      // Assert
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'biker123 liked your post',
          body: 'Check out my ride!',
        }),
      );
    });

    it('should use custom title and body if provided', async () => {
      // Act - skip preferences check
      await service.create(
        {
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          recipientId: userId,
          title: 'Custom Title',
          body: 'Custom Body',
        },
        { skipPreferenceCheck: true },
      );

      // Assert
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Title',
          body: 'Custom Body',
        }),
      );
    });
  });
});
