import { Request, Response } from 'express';
import { notificationsService } from '../services/notifications.service';
import { GetNotificationsInput, NotificationIdInput } from '../validators/notifications';

export const notificationsController = {
  /**
   * Get user's notifications
   * GET /api/v1/notifications
   */
  async getNotifications(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { page, limit } = req.query as unknown as GetNotificationsInput;

    const pageNum = Math.max(1, parseInt(String(page) || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(String(limit) || '20', 10) || 20));

    const result = await notificationsService.getNotifications(userId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  /**
   * Get unread notifications count
   * GET /api/v1/notifications/unread
   */
  async getUnreadCount(req: Request, res: Response) {
    const userId = req.user!.userId;

    const count = await notificationsService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount: count },
    });
  },

  /**
   * Mark a notification as read
   * POST /api/v1/notifications/:id/read
   */
  async markAsRead(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params as NotificationIdInput;

    await notificationsService.markAsRead(userId, id);

    res.json({
      success: true,
      data: { message: 'წაკითხულად მონიშნულია' },
    });
  },

  /**
   * Mark all notifications as read
   * POST /api/v1/notifications/read-all
   */
  async markAllAsRead(req: Request, res: Response) {
    const userId = req.user!.userId;

    const count = await notificationsService.markAllAsRead(userId);

    res.json({
      success: true,
      data: {
        message: 'ყველა ნოტიფიკაცია წაკითხულად მონიშნულია',
        count,
      },
    });
  },

  /**
   * Delete a notification
   * DELETE /api/v1/notifications/:id
   */
  async deleteNotification(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params as NotificationIdInput;

    await notificationsService.deleteNotification(userId, id);

    res.json({
      success: true,
      data: { message: 'ნოტიფიკაცია წაშლილია' },
    });
  },
};
