import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '@modules/notifications/notifications.service.js';
import {
  QUEUE_NAMES,
  CLEANUP_JOBS,
  CleanupJobData,
  CleanupJobResult,
} from '../interfaces/job-data.interface.js';

@Processor(QUEUE_NAMES.CLEANUP)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService | null,
    // TODO: Inject other services as needed
    // private readonly storiesService: StoriesService,
    // private readonly mediaService: MediaService,
    // private readonly deviceTokensService: DeviceTokensService,
  ) {
    super();
  }

  async process(job: Job<CleanupJobData>): Promise<CleanupJobResult> {
    this.logger.log(`Processing cleanup job: ${job.name}`);

    switch (job.name) {
      case CLEANUP_JOBS.EXPIRED_STORIES:
        return this.cleanupExpiredStories(job);

      case CLEANUP_JOBS.OLD_NOTIFICATIONS:
        return this.cleanupOldNotifications(job);

      case CLEANUP_JOBS.INACTIVE_TOKENS:
        return this.cleanupInactiveTokens(job);

      case CLEANUP_JOBS.ORPHANED_MEDIA:
        return this.cleanupOrphanedMedia(job);

      default:
        this.logger.warn(`Unknown cleanup job type: ${job.name}`);
        return { deletedCount: 0, errors: [`Unknown job type: ${job.name}`] };
    }
  }

  private async cleanupExpiredStories(
    _job: Job<CleanupJobData>,
  ): Promise<CleanupJobResult> {
    this.logger.log('Cleaning up expired stories...');

    try {
      // TODO: Implement when StoriesService is available
      /*
      const deletedCount = await this.storiesService.deleteExpired();

      // Also clean up media from R2
      const orphanedMedia = await this.mediaService.findOrphanedStoryMedia();
      await this.mediaService.deleteMany(orphanedMedia);
      */

      const deletedCount = 0; // Placeholder
      this.logger.log(`Deleted ${deletedCount} expired stories`);

      return { deletedCount };
    } catch (error) {
      this.logger.error(
        `Error cleaning up stories: ${(error as Error).message}`,
      );
      return { deletedCount: 0, errors: [(error as Error).message] };
    }
  }

  private async cleanupOldNotifications(
    job: Job<CleanupJobData>,
  ): Promise<CleanupJobResult> {
    const days = job.data?.params?.olderThanDays || 30;
    this.logger.log(`Cleaning up notifications older than ${days} days...`);

    if (!this.notificationsService) {
      this.logger.warn('NotificationsService not available, skipping cleanup');
      return {
        deletedCount: 0,
        errors: ['NotificationsService not available'],
      };
    }

    try {
      const deletedCount = await this.notificationsService.deleteOld(days);
      this.logger.log(`Deleted ${deletedCount} old notifications`);

      return { deletedCount };
    } catch (error) {
      this.logger.error(
        `Error cleaning up notifications: ${(error as Error).message}`,
      );
      return { deletedCount: 0, errors: [(error as Error).message] };
    }
  }

  private async cleanupInactiveTokens(
    _job: Job<CleanupJobData>,
  ): Promise<CleanupJobResult> {
    this.logger.log('Cleaning up inactive device tokens...');

    try {
      // TODO: Implement when DeviceTokensService is available
      /*
      const days = job.data?.params?.olderThanDays || 90;
      const deletedCount = await this.deviceTokensService.deleteInactive(days);
      */

      const deletedCount = 0; // Placeholder
      this.logger.log(`Deleted ${deletedCount} inactive device tokens`);

      return { deletedCount };
    } catch (error) {
      this.logger.error(
        `Error cleaning up tokens: ${(error as Error).message}`,
      );
      return { deletedCount: 0, errors: [(error as Error).message] };
    }
  }

  private async cleanupOrphanedMedia(
    _job: Job<CleanupJobData>,
  ): Promise<CleanupJobResult> {
    this.logger.log('Cleaning up orphaned media files...');

    try {
      // TODO: Implement when MediaService has orphan detection
      /*
      const batchSize = job.data?.params?.batchSize || 100;
      const orphanedFiles = await this.mediaService.findOrphaned(batchSize);

      for (const file of orphanedFiles) {
        await this.mediaService.delete(file.id);
      }

      const deletedCount = orphanedFiles.length;
      */

      const deletedCount = 0; // Placeholder
      this.logger.log(`Deleted ${deletedCount} orphaned media files`);

      return { deletedCount };
    } catch (error) {
      this.logger.error(`Error cleaning up media: ${(error as Error).message}`);
      return { deletedCount: 0, errors: [(error as Error).message] };
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CleanupJobData>, result: CleanupJobResult) {
    this.logger.log(
      `Cleanup job ${job.name} completed: ${result.deletedCount} items deleted`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CleanupJobData>, error: Error) {
    this.logger.error(
      `Cleanup job ${job.name} failed: ${error.message}`,
      error.stack,
    );
  }
}
