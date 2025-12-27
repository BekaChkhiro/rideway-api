import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import {
  QUEUE_NAMES,
  CLEANUP_JOBS,
  NotificationJobData,
  PushJobData,
  CleanupJobData,
  DEFAULT_JOB_OPTIONS,
  JOB_PRIORITIES,
} from './interfaces/job-data.interface.js';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue<NotificationJobData>,
    @InjectQueue(QUEUE_NAMES.PUSH)
    private readonly pushQueue: Queue<PushJobData>,
    @InjectQueue(QUEUE_NAMES.CLEANUP)
    private readonly cleanupQueue: Queue<CleanupJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      // Add timeout to prevent hanging during startup
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Scheduling jobs timed out after 10s')), 10000)
      );
      await Promise.race([this.scheduleRecurringJobs(), timeoutPromise]);
    } catch (error) {
      this.logger.warn(`Failed to schedule recurring jobs: ${(error as Error).message}`);
      // Don't block startup if scheduling fails
    }
  }

  // ==========================================
  // Notification Jobs
  // ==========================================

  async addNotificationJob(
    data: NotificationJobData,
    options?: Partial<JobsOptions>,
  ): Promise<Job<NotificationJobData>> {
    const job = await this.notificationsQueue.add(
      'notification',
      data,
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: JOB_PRIORITIES.MEDIUM,
        ...options,
      },
    );

    this.logger.debug(
      `Added notification job ${job.id}: ${data.type} for user ${data.recipientId}`,
    );

    return job;
  }

  async addNotificationJobBatch(
    dataList: NotificationJobData[],
  ): Promise<Job<NotificationJobData>[]> {
    const jobs = await this.notificationsQueue.addBulk(
      dataList.map((data) => ({
        name: 'notification',
        data,
        opts: {
          ...DEFAULT_JOB_OPTIONS,
          priority: JOB_PRIORITIES.MEDIUM,
        },
      })),
    );

    this.logger.debug(`Added ${jobs.length} notification jobs in batch`);

    return jobs;
  }

  // ==========================================
  // Push Notification Jobs
  // ==========================================

  async addPushJob(
    data: PushJobData,
    options?: Partial<JobsOptions>,
  ): Promise<Job<PushJobData>> {
    const job = await this.pushQueue.add(
      'push',
      data,
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: JOB_PRIORITIES.HIGH, // Push notifications are high priority
        ...options,
      },
    );

    this.logger.debug(
      `Added push notification job ${job.id} for user ${data.userId}`,
    );

    return job;
  }

  // ==========================================
  // Cleanup Jobs
  // ==========================================

  async addCleanupJob(
    jobName: typeof CLEANUP_JOBS[keyof typeof CLEANUP_JOBS],
    data: Partial<CleanupJobData> = {},
    options?: Partial<JobsOptions>,
  ): Promise<Job<CleanupJobData>> {
    const job = await this.cleanupQueue.add(
      jobName,
      { type: jobName, ...data } as CleanupJobData,
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: JOB_PRIORITIES.LOW,
        ...options,
      },
    );

    this.logger.debug(`Added cleanup job ${job.id}: ${jobName}`);

    return job;
  }

  // ==========================================
  // Job Status
  // ==========================================

  async getJobStatus(
    queueName: string,
    jobId: string,
  ): Promise<{
    state: string;
    progress: number;
    attemptsMade: number;
    failedReason?: string;
  } | null> {
    let queue: Queue;

    switch (queueName) {
      case QUEUE_NAMES.NOTIFICATIONS:
        queue = this.notificationsQueue;
        break;
      case QUEUE_NAMES.PUSH:
        queue = this.pushQueue;
        break;
      case QUEUE_NAMES.CLEANUP:
        queue = this.cleanupQueue;
        break;
      default:
        return null;
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();

    return {
      state,
      progress: job.progress as number,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
    };
  }

  // ==========================================
  // Queue Stats
  // ==========================================

  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null> {
    let queue: Queue;

    switch (queueName) {
      case QUEUE_NAMES.NOTIFICATIONS:
        queue = this.notificationsQueue;
        break;
      case QUEUE_NAMES.PUSH:
        queue = this.pushQueue;
        break;
      case QUEUE_NAMES.CLEANUP:
        queue = this.cleanupQueue;
        break;
      default:
        return null;
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async getAllQueuesStats(): Promise<
    Record<string, { waiting: number; active: number; completed: number; failed: number; delayed: number }>
  > {
    const [notifications, push, cleanup] = await Promise.all([
      this.getQueueStats(QUEUE_NAMES.NOTIFICATIONS),
      this.getQueueStats(QUEUE_NAMES.PUSH),
      this.getQueueStats(QUEUE_NAMES.CLEANUP),
    ]);

    return {
      [QUEUE_NAMES.NOTIFICATIONS]: notifications!,
      [QUEUE_NAMES.PUSH]: push!,
      [QUEUE_NAMES.CLEANUP]: cleanup!,
    };
  }

  // ==========================================
  // Queue Management
  // ==========================================

  async retryFailedJobs(queueName: string, limit: number = 100): Promise<number> {
    let queue: Queue;

    switch (queueName) {
      case QUEUE_NAMES.NOTIFICATIONS:
        queue = this.notificationsQueue;
        break;
      case QUEUE_NAMES.PUSH:
        queue = this.pushQueue;
        break;
      case QUEUE_NAMES.CLEANUP:
        queue = this.cleanupQueue;
        break;
      default:
        return 0;
    }

    const failedJobs = await queue.getFailed(0, limit);
    let retriedCount = 0;

    for (const job of failedJobs) {
      await job.retry();
      retriedCount++;
    }

    this.logger.log(`Retried ${retriedCount} failed jobs in ${queueName} queue`);

    return retriedCount;
  }

  async clearQueue(
    queueName: string,
    status: 'completed' | 'failed' | 'delayed' | 'wait' = 'completed',
  ): Promise<void> {
    let queue: Queue;

    switch (queueName) {
      case QUEUE_NAMES.NOTIFICATIONS:
        queue = this.notificationsQueue;
        break;
      case QUEUE_NAMES.PUSH:
        queue = this.pushQueue;
        break;
      case QUEUE_NAMES.CLEANUP:
        queue = this.cleanupQueue;
        break;
      default:
        return;
    }

    await queue.clean(0, 0, status);
    this.logger.log(`Cleared ${status} jobs from ${queueName} queue`);
  }

  // ==========================================
  // Scheduled Jobs
  // ==========================================

  private async scheduleRecurringJobs(): Promise<void> {
    this.logger.log('Scheduling recurring cleanup jobs...');

    // Remove existing repeatable jobs first to avoid duplicates
    const existingJobs = await this.cleanupQueue.getRepeatableJobs();
    for (const job of existingJobs) {
      await this.cleanupQueue.removeRepeatableByKey(job.key);
    }

    // Expired stories cleanup - every hour
    await this.cleanupQueue.add(
      CLEANUP_JOBS.EXPIRED_STORIES,
      { type: CLEANUP_JOBS.EXPIRED_STORIES },
      {
        repeat: { pattern: '0 * * * *' }, // Every hour at minute 0
        ...DEFAULT_JOB_OPTIONS,
        priority: JOB_PRIORITIES.LOW,
      },
    );

    // Old notifications cleanup - daily at 3 AM
    await this.cleanupQueue.add(
      CLEANUP_JOBS.OLD_NOTIFICATIONS,
      { type: CLEANUP_JOBS.OLD_NOTIFICATIONS, params: { olderThanDays: 30 } },
      {
        repeat: { pattern: '0 3 * * *' }, // 3 AM daily
        ...DEFAULT_JOB_OPTIONS,
        priority: JOB_PRIORITIES.LOW,
      },
    );

    // Inactive tokens cleanup - weekly on Sunday at 4 AM
    await this.cleanupQueue.add(
      CLEANUP_JOBS.INACTIVE_TOKENS,
      { type: CLEANUP_JOBS.INACTIVE_TOKENS, params: { olderThanDays: 90 } },
      {
        repeat: { pattern: '0 4 * * 0' }, // Sunday at 4 AM
        ...DEFAULT_JOB_OPTIONS,
        priority: JOB_PRIORITIES.LOW,
      },
    );

    // Orphaned media cleanup - daily at 5 AM
    await this.cleanupQueue.add(
      CLEANUP_JOBS.ORPHANED_MEDIA,
      { type: CLEANUP_JOBS.ORPHANED_MEDIA, params: { batchSize: 100 } },
      {
        repeat: { pattern: '0 5 * * *' }, // 5 AM daily
        ...DEFAULT_JOB_OPTIONS,
        priority: JOB_PRIORITIES.LOW,
      },
    );

    const scheduledJobs = await this.cleanupQueue.getRepeatableJobs();
    this.logger.log(`Scheduled ${scheduledJobs.length} recurring cleanup jobs`);
  }
}
