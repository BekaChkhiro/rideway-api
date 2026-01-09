import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error-handler';

interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
}

interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export const notificationsService = {
  /**
   * Get user's notifications (paginated)
   */
  async getNotifications(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<NotificationResponse>> {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          data: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId },
      }),
    ]);

    const items: NotificationResponse[] = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data as Record<string, unknown> | null,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get unread notifications count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'ნოტიფიკაცია ვერ მოიძებნა');
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return result.count;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'ნოტიფიკაცია ვერ მოიძებნა');
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });
  },

  /**
   * Create a notification (used by other services)
   */
  async createNotification(data: CreateNotificationData): Promise<NotificationResponse> {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data as Record<string, unknown> | null,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  },

  /**
   * Delete old notifications (cleanup job)
   * Removes notifications older than specified days
   */
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    return result.count;
  },
};
