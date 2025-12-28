import { NotificationType } from '@modules/notifications/constants/notification-types.constant.js';

// Queue names
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  PUSH: 'push-notifications',
  EMAIL: 'email',
  CLEANUP: 'cleanup',
} as const;

// Job names for cleanup queue
export const CLEANUP_JOBS = {
  EXPIRED_STORIES: 'expired-stories',
  OLD_NOTIFICATIONS: 'old-notifications',
  INACTIVE_TOKENS: 'inactive-tokens',
  ORPHANED_MEDIA: 'orphaned-media',
} as const;

// Notification job data
export interface NotificationJobData {
  type: NotificationType;
  recipientId: string;
  senderId?: string;
  title?: string;
  body?: string;
  data?: {
    entityType?: string;
    entityId?: string;
    deepLink?: string;
    [key: string]: unknown;
  };
  variables?: Record<string, string>;
}

// Push notification job data
export interface PushJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  imageUrl?: string;
  // Optional: specific tokens to send to (if not provided, send to all user's devices)
  tokens?: string[];
}

// Email job data (for future use)
export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

// Cleanup job data
export interface CleanupJobData {
  type: (typeof CLEANUP_JOBS)[keyof typeof CLEANUP_JOBS];
  params?: {
    olderThanDays?: number;
    batchSize?: number;
  };
}

// Job result interfaces
export interface NotificationJobResult {
  notificationId?: string;
  pushQueued: boolean;
  skipped: boolean;
  reason?: string;
}

export interface PushJobResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export interface CleanupJobResult {
  deletedCount: number;
  errors?: string[];
}

// Job options with priority
export const JOB_PRIORITIES = {
  HIGH: 1,
  MEDIUM: 5,
  LOW: 10,
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 3600, // 1 hour
    count: 1000,
  },
  removeOnFail: {
    age: 86400, // 24 hours
  },
};
