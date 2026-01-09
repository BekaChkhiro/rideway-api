import { Router } from 'express';
import { notificationsController } from '../controllers/notifications.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate } from '../middleware/auth';
import { getNotificationsSchema, notificationIdSchema } from '../validators/notifications';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Get unread count
router.get('/unread', asyncHandler(notificationsController.getUnreadCount));

// Get notifications (paginated)
router.get(
  '/',
  validate(getNotificationsSchema, 'query'),
  asyncHandler(notificationsController.getNotifications)
);

// Mark all as read
router.post('/read-all', asyncHandler(notificationsController.markAllAsRead));

// Mark single notification as read
router.post(
  '/:id/read',
  validate(notificationIdSchema, 'params'),
  asyncHandler(notificationsController.markAsRead)
);

// Delete notification
router.delete(
  '/:id',
  validate(notificationIdSchema, 'params'),
  asyncHandler(notificationsController.deleteNotification)
);

export default router;
