import { z } from 'zod';

// Pagination query params
export const getNotificationsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type GetNotificationsInput = z.infer<typeof getNotificationsSchema>;

// Notification ID param
export const notificationIdSchema = z.object({
  id: z.string().uuid('არასწორი ნოტიფიკაციის ID'),
});

export type NotificationIdInput = z.infer<typeof notificationIdSchema>;
