import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { FCMService, DeviceTokensService } from '@modules/notifications/fcm/index.js';
import {
  QUEUE_NAMES,
  PushJobData,
  PushJobResult,
} from '../interfaces/job-data.interface.js';

@Processor(QUEUE_NAMES.PUSH)
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(
    @Optional()
    @Inject(forwardRef(() => FCMService))
    private readonly fcmService: FCMService | null,
    @Optional()
    @Inject(forwardRef(() => DeviceTokensService))
    private readonly deviceTokensService: DeviceTokensService | null,
  ) {
    super();
  }

  async process(job: Job<PushJobData>): Promise<PushJobResult> {
    this.logger.debug(`Processing push notification job ${job.id}`);

    const { userId, title, body, data, badge, sound, imageUrl, tokens } = job.data;

    // Check if services are available
    if (!this.fcmService || !this.deviceTokensService) {
      this.logger.warn('FCM services not available, skipping push notification');
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
      };
    }

    try {
      // Check if FCM is available
      if (!this.fcmService.isAvailable()) {
        this.logger.warn('FCM not available, skipping push notification');
        return {
          successCount: 0,
          failureCount: 0,
          invalidTokens: [],
        };
      }

      // Get device tokens if not provided
      const deviceTokens = tokens || await this.deviceTokensService.getActiveTokens(userId);

      if (deviceTokens.length === 0) {
        this.logger.debug(`No device tokens for user ${userId}`);
        return {
          successCount: 0,
          failureCount: 0,
          invalidTokens: [],
        };
      }

      // Send to FCM
      const result = await this.fcmService.sendToTokens(deviceTokens, {
        title,
        body,
        data,
        badge,
        sound,
        imageUrl,
      });

      this.logger.log(
        `Push notification sent to user ${userId}: ${result.successCount} success, ${result.failureCount} failed`,
      );

      return {
        successCount: result.successCount,
        failureCount: result.failureCount,
        invalidTokens: result.failedTokens,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process push job ${job.id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PushJobData>, result: PushJobResult) {
    this.logger.debug(
      `Push job ${job.id} completed: ${result.successCount} success, ${result.failureCount} failed`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PushJobData>, error: Error) {
    this.logger.error(
      `Push job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );

    // Alert if all retries exhausted
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      this.logger.error(
        `Push notification to user ${job.data.userId} permanently failed`,
      );
    }
  }
}
