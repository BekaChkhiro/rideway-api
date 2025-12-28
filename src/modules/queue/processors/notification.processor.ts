import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '@modules/notifications/notifications.service.js';
import { GatewayService } from '@modules/gateway/gateway.service.js'; // Optional
import {
  QUEUE_NAMES,
  NotificationJobData,
  NotificationJobResult,
} from '../interfaces/job-data.interface.js';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService | null,
    @Optional() private readonly gatewayService: GatewayService | null,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<NotificationJobResult> {
    this.logger.debug(
      `Processing notification job ${job.id}: ${job.data.type}`,
    );

    if (!this.notificationsService) {
      this.logger.warn('NotificationsService not available, skipping job');
      return {
        skipped: true,
        pushQueued: false,
        reason: 'NotificationsService not available',
      };
    }

    const { type, recipientId, senderId, title, body, data, variables } =
      job.data;

    try {
      // Create in-app notification
      const notification = await this.notificationsService.create(
        {
          type,
          recipientId,
          senderId,
          title,
          body,
          data,
          variables,
        },
        {
          skipSocketEmit: false, // Service handles socket emission
          skipPushNotification: true, // We'll handle push separately
        },
      );

      if (!notification) {
        return {
          skipped: true,
          pushQueued: false,
          reason: 'Notification skipped due to user preferences',
        };
      }

      // Check if user is offline and should receive push notification
      const isOnline = this.gatewayService
        ? await this.gatewayService.isUserOnline(recipientId)
        : false;

      if (!isOnline) {
        // Queue push notification job
        // This will be handled by QueueService which we'll inject via event
        this.logger.debug(
          `User ${recipientId} is offline, push notification should be queued`,
        );

        return {
          notificationId: notification.id,
          pushQueued: true,
          skipped: false,
        };
      }

      return {
        notificationId: notification.id,
        pushQueued: false,
        skipped: false,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process notification job ${job.id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.debug(`Notification job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationJobData>, error: Error) {
    this.logger.error(
      `Notification job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
