import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RedisService } from '@redis/redis.service.js';
import { GatewayService } from '@modules/gateway/gateway.service.js'; // Optional - can be null
import { QueueService } from '@modules/queue/queue.service.js';
import { Notification, NotificationPreferences } from './entities/index.js';
import {
  NotificationType,
  NotificationTemplates,
  NotificationPreferenceKeys,
} from './constants/notification-types.constant.js';
import { NotificationQueryDto } from './dto/index.js';
import {
  NotificationPayload,
  NotificationResponse,
  NotificationListResponse,
  CreateNotificationOptions,
} from './interfaces/index.js';

const REDIS_KEYS = {
  UNREAD_COUNT: 'notification:unread:', // notification:unread:{userId} -> count
} as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreferences)
    private readonly preferencesRepository: Repository<NotificationPreferences>,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Optional() @Inject(GatewayService) private readonly gatewayService: GatewayService | null,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) {}

  /**
   * Create a new notification
   */
  async create(
    payload: NotificationPayload,
    options: CreateNotificationOptions = {},
  ): Promise<Notification | null> {
    const { type, recipientId, senderId, data, variables } = payload;

    // Check recipient preferences unless skipped
    if (!options.skipPreferenceCheck) {
      const shouldNotify = await this.checkPreferences(recipientId, type);
      if (!shouldNotify) {
        this.logger.debug(
          `Notification ${type} skipped for user ${recipientId} - preferences disabled`,
        );
        return null;
      }
    }

    // Generate title and body from template
    const template = NotificationTemplates[type];
    const title = payload.title || this.interpolate(template.title, variables || {});
    const body = payload.body || this.interpolate(template.body, variables || {});

    // Create notification
    const notification = this.notificationRepository.create({
      userId: recipientId,
      type,
      title,
      body,
      data,
      senderId,
    });

    await this.notificationRepository.save(notification);

    // Invalidate unread count cache
    await this.invalidateUnreadCache(recipientId);

    // Emit via socket if user is online
    if (!options.skipSocketEmit) {
      await this.emitNotification(notification);
    }

    // Queue push notification if user is offline
    if (!options.skipPushNotification) {
      const isOnline = this.gatewayService ? await this.gatewayService.isUserOnline(recipientId) : false;
      if (!isOnline) {
        await this.queueService.addPushJob({
          userId: recipientId,
          title,
          body,
          data: {
            notificationId: notification.id,
            type,
            entityType: data?.entityType,
            entityId: data?.entityId,
            deepLink: data?.deepLink,
          },
        });
        this.logger.debug(
          `Queued push notification for offline user ${recipientId}`,
        );
      }
    }

    this.logger.debug(
      `Created notification ${notification.id} of type ${type} for user ${recipientId}`,
    );

    return notification;
  }

  /**
   * Get paginated notifications for a user
   */
  async findAll(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<NotificationListResponse> {
    const { limit = 20, offset = 0, unreadOnly = false, type } = query;

    const whereConditions: Record<string, unknown> = { userId };

    if (unreadOnly) {
      whereConditions.isRead = false;
    }

    if (type) {
      whereConditions.type = type;
    }

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: whereConditions,
      relations: ['sender', 'sender.profile'],
      order: { createdAt: 'DESC' },
      take: limit + 1, // Fetch one extra to check hasMore
      skip: offset,
    });

    const hasMore = notifications.length > limit;
    if (hasMore) {
      notifications.pop();
    }

    const unreadCount = await this.getUnreadCount(userId);

    const notificationResponses: NotificationResponse[] = notifications.map((n) =>
      this.mapToResponse(n),
    );

    return {
      notifications: notificationResponses,
      total,
      unreadCount,
      hasMore,
    };
  }

  /**
   * Get a single notification
   */
  async findOne(id: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
      relations: ['sender', 'sender.profile'],
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.mapToResponse(notification);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot mark this notification as read');
    }

    if (!notification.isRead) {
      await this.notificationRepository.update(id, {
        isRead: true,
        readAt: new Date(),
      });

      await this.invalidateUnreadCache(userId);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    await this.invalidateUnreadCache(userId);

    return result.affected || 0;
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    // Try cache first
    const cached = await this.redisService.get(
      `${REDIS_KEYS.UNREAD_COUNT}${userId}`,
    );

    if (cached !== null) {
      return parseInt(cached, 10);
    }

    // Query database
    const count = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    // Cache for 5 minutes
    await this.redisService.set(
      `${REDIS_KEYS.UNREAD_COUNT}${userId}`,
      count.toString(),
      300,
    );

    return count;
  }

  /**
   * Get notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    let preferences = await this.preferencesRepository.findOne({
      where: { userId },
    });

    if (!preferences) {
      // Create default preferences
      preferences = this.preferencesRepository.create({ userId });
      await this.preferencesRepository.save(preferences);
    }

    return preferences;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    let preferences = await this.preferencesRepository.findOne({
      where: { userId },
    });

    if (!preferences) {
      preferences = this.preferencesRepository.create({ userId, ...updates });
    } else {
      Object.assign(preferences, updates);
    }

    await this.preferencesRepository.save(preferences);
    return preferences;
  }

  /**
   * Delete old notifications
   */
  async deleteOld(days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.notificationRepository.delete({
      createdAt: LessThan(cutoffDate),
      isRead: true,
    });

    this.logger.log(`Deleted ${result.affected} old notifications`);
    return result.affected || 0;
  }

  /**
   * Delete a notification
   */
  async delete(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationRepository.delete(id);

    if (!notification.isRead) {
      await this.invalidateUnreadCache(userId);
    }
  }

  // ==========================================
  // Helper methods for specific notification types
  // ==========================================

  async notifyNewFollower(followerId: string, followedId: string, followerUsername: string): Promise<void> {
    await this.create({
      type: NotificationType.NEW_FOLLOWER,
      recipientId: followedId,
      senderId: followerId,
      variables: { username: followerUsername },
      data: {
        entityType: 'user',
        entityId: followerId,
        deepLink: `/users/${followerId}`,
      },
    });
  }

  async notifyPostLike(
    likerId: string,
    postOwnerId: string,
    postId: string,
    likerUsername: string,
    postPreview: string,
  ): Promise<void> {
    if (likerId === postOwnerId) return; // Don't notify self

    await this.create({
      type: NotificationType.POST_LIKE,
      recipientId: postOwnerId,
      senderId: likerId,
      variables: { username: likerUsername, postPreview: postPreview.substring(0, 50) },
      data: {
        entityType: 'post',
        entityId: postId,
        deepLink: `/posts/${postId}`,
      },
    });
  }

  async notifyPostComment(
    commenterId: string,
    postOwnerId: string,
    postId: string,
    commentId: string,
    commenterUsername: string,
    commentPreview: string,
  ): Promise<void> {
    if (commenterId === postOwnerId) return;

    await this.create({
      type: NotificationType.POST_COMMENT,
      recipientId: postOwnerId,
      senderId: commenterId,
      variables: { username: commenterUsername, commentPreview: commentPreview.substring(0, 50) },
      data: {
        entityType: 'comment',
        entityId: commentId,
        postId,
        deepLink: `/posts/${postId}?comment=${commentId}`,
      },
    });
  }

  async notifyCommentReply(
    replierId: string,
    commentOwnerId: string,
    postId: string,
    commentId: string,
    replyId: string,
    replierUsername: string,
    replyPreview: string,
  ): Promise<void> {
    if (replierId === commentOwnerId) return;

    await this.create({
      type: NotificationType.COMMENT_REPLY,
      recipientId: commentOwnerId,
      senderId: replierId,
      variables: { username: replierUsername, replyPreview: replyPreview.substring(0, 50) },
      data: {
        entityType: 'comment',
        entityId: replyId,
        parentCommentId: commentId,
        postId,
        deepLink: `/posts/${postId}?comment=${replyId}`,
      },
    });
  }

  async notifyNewMessage(
    senderId: string,
    recipientId: string,
    conversationId: string,
    senderUsername: string,
    messagePreview: string,
  ): Promise<void> {
    if (senderId === recipientId) return;

    await this.create({
      type: NotificationType.NEW_MESSAGE,
      recipientId,
      senderId,
      variables: { username: senderUsername, messagePreview: messagePreview.substring(0, 50) },
      data: {
        entityType: 'conversation',
        entityId: conversationId,
        deepLink: `/chat/${conversationId}`,
      },
    });
  }

  async notifyThreadReply(
    replierId: string,
    threadOwnerId: string,
    threadId: string,
    replyId: string,
    replierUsername: string,
    replyPreview: string,
  ): Promise<void> {
    if (replierId === threadOwnerId) return;

    await this.create({
      type: NotificationType.THREAD_REPLY,
      recipientId: threadOwnerId,
      senderId: replierId,
      variables: { username: replierUsername, replyPreview: replyPreview.substring(0, 50) },
      data: {
        entityType: 'thread_reply',
        entityId: replyId,
        threadId,
        deepLink: `/forum/threads/${threadId}?reply=${replyId}`,
      },
    });
  }

  async notifyListingInquiry(
    inquirerId: string,
    listingOwnerId: string,
    listingId: string,
    inquirerUsername: string,
    listingTitle: string,
  ): Promise<void> {
    if (inquirerId === listingOwnerId) return;

    await this.create({
      type: NotificationType.LISTING_INQUIRY,
      recipientId: listingOwnerId,
      senderId: inquirerId,
      variables: { username: inquirerUsername, listingTitle: listingTitle.substring(0, 50) },
      data: {
        entityType: 'listing',
        entityId: listingId,
        deepLink: `/marketplace/${listingId}`,
      },
    });
  }

  // ==========================================
  // Private helper methods
  // ==========================================

  private async checkPreferences(
    userId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const preferences = await this.getPreferences(userId);

    // Check if push is globally disabled
    if (!preferences.pushEnabled) {
      return false;
    }

    // Check specific preference if exists
    const preferenceKey = NotificationPreferenceKeys[type];
    if (preferenceKey && preferenceKey in preferences) {
      return (preferences as Record<string, boolean>)[preferenceKey];
    }

    // Default to enabled for types without specific preferences
    return true;
  }

  private interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => variables[key] || match);
  }

  private async invalidateUnreadCache(userId: string): Promise<void> {
    await this.redisService.del(`${REDIS_KEYS.UNREAD_COUNT}${userId}`);
  }

  private async emitNotification(notification: Notification): Promise<void> {
    if (!this.gatewayService) {
      return; // Gateway not available
    }

    const isOnline = await this.gatewayService.isUserOnline(notification.userId);

    if (isOnline) {
      // Load sender info
      const fullNotification = await this.notificationRepository.findOne({
        where: { id: notification.id },
        relations: ['sender', 'sender.profile'],
      });

      if (fullNotification) {
        this.gatewayService.emitToUser(
          notification.userId,
          'notification:new',
          {
            id: fullNotification.id,
            type: fullNotification.type,
            title: fullNotification.title,
            body: fullNotification.body,
            data: fullNotification.data,
            createdAt: fullNotification.createdAt,
          },
        );
      }
    }
  }

  private mapToResponse(notification: Notification): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type as NotificationType,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      sender: notification.sender
        ? {
            id: notification.sender.id,
            username: notification.sender.profile?.username || 'Unknown',
            avatarUrl: notification.sender.profile?.avatarUrl,
          }
        : undefined,
    };
  }
}
