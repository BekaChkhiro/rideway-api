import { NotificationType } from '../constants/notification-types.constant.js';

export interface NotificationPayload {
  type: NotificationType;
  recipientId: string;
  senderId?: string;
  title?: string;
  body?: string;
  data?: {
    entityType?: string; // post, comment, thread, listing, conversation
    entityId?: string;
    deepLink?: string;
    [key: string]: unknown;
  };
  // Template variables for title/body
  variables?: Record<string, string>;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  sender?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  total: number;
  unreadCount: number;
  hasMore: boolean;
}

export interface CreateNotificationOptions {
  skipPreferenceCheck?: boolean;
  skipSocketEmit?: boolean;
  skipPushNotification?: boolean;
}
