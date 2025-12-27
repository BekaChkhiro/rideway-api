import { NotificationType } from '../constants/notification-types.constant.js';

export interface PushPayload {
  title: string;
  body: string;
  data?: {
    type?: NotificationType | string;
    notificationId?: string;
    entityType?: string;
    entityId?: string;
    deepLink?: string;
    [key: string]: string | undefined;
  };
  badge?: number;
  sound?: string;
  imageUrl?: string;
}

export interface SendResult {
  successCount: number;
  failureCount: number;
  failedTokens: string[];
}

export interface RegisterDeviceDto {
  token: string;
  deviceType: 'ios' | 'android' | 'web';
  deviceName?: string;
  deviceId?: string;
}

export interface DeviceInfo {
  id: string;
  deviceType: string;
  deviceName?: string;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
}
