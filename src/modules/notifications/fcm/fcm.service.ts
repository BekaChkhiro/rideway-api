import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { DeviceTokensService } from './device-tokens.service.js';
import { PushPayload, SendResult } from './fcm.interfaces.js';

@Injectable()
export class FCMService implements OnModuleInit {
  private readonly logger = new Logger(FCMService.name);
  private isInitialized = false;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(DeviceTokensService)
    private readonly deviceTokensService: DeviceTokensService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      // Add timeout to prevent blocking startup
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error('FCM initialization timed out after 10s')),
          10000,
        ),
      );
      await Promise.race([this.initialize(), timeoutPromise]);
    } catch (error) {
      this.logger.warn(
        `FCM initialization failed: ${(error as Error).message}`,
      );
      // Don't block startup if FCM fails to initialize
    }
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private async initialize(): Promise<void> {
    const projectId = this.configService.get<string>('firebase.projectId');
    const privateKey = this.configService.get<string>('firebase.privateKey');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn(
        'Firebase credentials not configured. Push notifications disabled.',
      );
      return;
    }

    try {
      // Check if already initialized
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey,
            clientEmail,
          }),
        });
      }

      this.isInitialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Firebase: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Check if FCM is available
   */
  isAvailable(): boolean {
    return this.isInitialized;
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
    if (!this.isInitialized) {
      this.logger.warn('FCM not initialized, skipping push notification');
      return { successCount: 0, failureCount: 0, failedTokens: [] };
    }

    const tokens = await this.deviceTokensService.getActiveTokens(userId);

    if (tokens.length === 0) {
      this.logger.debug(`No active tokens for user ${userId}`);
      return { successCount: 0, failureCount: 0, failedTokens: [] };
    }

    return this.sendToTokens(tokens, payload);
  }

  /**
   * Send push notification to multiple tokens
   */
  async sendToTokens(
    tokens: string[],
    payload: PushPayload,
  ): Promise<SendResult> {
    if (!this.isInitialized) {
      return { successCount: 0, failureCount: 0, failedTokens: [] };
    }

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, failedTokens: [] };
    }

    const messages = tokens.map((token) => this.buildMessage(payload, token));

    try {
      const response = await admin.messaging().sendEach(messages);

      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          // Mark token as invalid if it's unregistered or invalid
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokens[idx]);
          }
          this.logger.debug(`Failed to send to token: ${resp.error?.message}`);
        }
      });

      // Remove invalid tokens
      if (failedTokens.length > 0) {
        await this.deviceTokensService.removeInvalidTokens(failedTokens);
      }

      this.logger.debug(
        `Push notification sent: ${response.successCount} success, ${response.failureCount} failed`,
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        failedTokens,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send push notifications: ${(error as Error).message}`,
      );
      return {
        successCount: 0,
        failureCount: tokens.length,
        failedTokens: [],
      };
    }
  }

  /**
   * Send push notification to a topic
   */
  async sendToTopic(topic: string, payload: PushPayload): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: this.stringifyData(payload.data),
        android: this.getAndroidConfig(payload),
        apns: this.getApnsConfig(payload),
      };

      const messageId = await admin.messaging().send(message);
      this.logger.debug(`Sent to topic ${topic}: ${messageId}`);

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send to topic ${topic}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Subscribe tokens to a topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<number> {
    if (!this.isInitialized || tokens.length === 0) {
      return 0;
    }

    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      this.logger.debug(
        `Subscribed ${response.successCount} tokens to topic ${topic}`,
      );
      return response.successCount;
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to topic: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Unsubscribe tokens from a topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<number> {
    if (!this.isInitialized || tokens.length === 0) {
      return 0;
    }

    try {
      const response = await admin
        .messaging()
        .unsubscribeFromTopic(tokens, topic);
      this.logger.debug(
        `Unsubscribed ${response.successCount} tokens from topic ${topic}`,
      );
      return response.successCount;
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from topic: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Build FCM message for a specific token
   */
  private buildMessage(
    payload: PushPayload,
    token: string,
  ): admin.messaging.Message {
    return {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: this.stringifyData(payload.data),
      android: this.getAndroidConfig(payload),
      apns: this.getApnsConfig(payload),
    };
  }

  /**
   * Get Android-specific configuration
   */
  private getAndroidConfig(
    payload: PushPayload,
  ): admin.messaging.AndroidConfig {
    return {
      priority: 'high',
      ttl: 86400 * 1000, // 24 hours in milliseconds
      notification: {
        sound: payload.sound || 'default',
        channelId: 'default',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    };
  }

  /**
   * Get iOS (APNs) specific configuration
   */
  private getApnsConfig(payload: PushPayload): admin.messaging.ApnsConfig {
    return {
      headers: {
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400), // 24 hours
      },
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          badge: payload.badge,
          sound: payload.sound || 'default',
          'mutable-content': 1,
          'content-available': 1,
        },
      },
    };
  }

  /**
   * Convert data object to string values (FCM requirement)
   */
  private stringifyData(
    data?: Record<string, string | undefined>,
  ): Record<string, string> | undefined {
    if (!data) return undefined;

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = String(value);
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
}
