import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { QueueService } from '../queue.service.js';
import {
  QUEUE_NAMES,
  CLEANUP_JOBS,
  NotificationType,
} from '../interfaces/job-data.interface.js';

describe('QueueService', () => {
  let service: QueueService;
  let mockNotificationsQueue: Record<string, Mock>;
  let mockPushQueue: Record<string, Mock>;
  let mockCleanupQueue: Record<string, Mock>;

  const userId = 'user-uuid-1234';
  const jobId = 'job-uuid-5678';

  beforeEach(() => {
    vi.clearAllMocks();

    const createMockQueue = () => ({
      add: vi.fn().mockResolvedValue({ id: jobId }),
      addBulk: vi.fn().mockResolvedValue([{ id: jobId }, { id: 'job-2' }]),
      getJob: vi.fn().mockResolvedValue(null),
      getWaitingCount: vi.fn().mockResolvedValue(5),
      getActiveCount: vi.fn().mockResolvedValue(2),
      getCompletedCount: vi.fn().mockResolvedValue(100),
      getFailedCount: vi.fn().mockResolvedValue(3),
      getDelayedCount: vi.fn().mockResolvedValue(1),
      getFailed: vi.fn().mockResolvedValue([]),
      clean: vi.fn().mockResolvedValue(undefined),
      getRepeatableJobs: vi.fn().mockResolvedValue([]),
      removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
    });

    mockNotificationsQueue = createMockQueue();
    mockPushQueue = createMockQueue();
    mockCleanupQueue = createMockQueue();

    service = new QueueService(
      mockNotificationsQueue as any,
      mockPushQueue as any,
      mockCleanupQueue as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('should schedule recurring cleanup jobs', async () => {
      // Act
      await service.onModuleInit();

      // Assert - should schedule 4 recurring jobs
      expect(mockCleanupQueue.add).toHaveBeenCalledTimes(4);
      expect(mockCleanupQueue.add).toHaveBeenCalledWith(
        CLEANUP_JOBS.EXPIRED_STORIES,
        expect.objectContaining({ type: CLEANUP_JOBS.EXPIRED_STORIES }),
        expect.objectContaining({ repeat: expect.any(Object) }),
      );
    });

    it('should remove existing repeatable jobs before scheduling', async () => {
      // Arrange
      mockCleanupQueue.getRepeatableJobs.mockResolvedValueOnce([
        { key: 'old-job-1' },
        { key: 'old-job-2' },
      ]);

      // Act
      await service.onModuleInit();

      // Assert
      expect(mockCleanupQueue.removeRepeatableByKey).toHaveBeenCalledTimes(2);
    });
  });

  describe('addNotificationJob', () => {
    it('should add notification job to queue', async () => {
      // Arrange
      const notificationData = {
        type: 'new_follower' as NotificationType,
        recipientId: userId,
        senderId: 'sender-123',
        variables: { username: 'testuser' },
      };

      // Act
      const result = await service.addNotificationJob(notificationData);

      // Assert
      expect(result.id).toBe(jobId);
      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'notification',
        notificationData,
        expect.objectContaining({
          attempts: expect.any(Number),
          backoff: expect.any(Object),
        }),
      );
    });

    it('should allow custom job options', async () => {
      // Arrange
      const notificationData = {
        type: 'post_like' as NotificationType,
        recipientId: userId,
      };
      const customOptions = { delay: 5000 };

      // Act
      await service.addNotificationJob(notificationData, customOptions);

      // Assert
      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'notification',
        notificationData,
        expect.objectContaining({ delay: 5000 }),
      );
    });
  });

  describe('addNotificationJobBatch', () => {
    it('should add multiple notification jobs in batch', async () => {
      // Arrange
      const dataList = [
        { type: 'new_follower' as NotificationType, recipientId: 'user-1' },
        { type: 'post_like' as NotificationType, recipientId: 'user-2' },
      ];

      // Act
      const result = await service.addNotificationJobBatch(dataList);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockNotificationsQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'notification' }),
          expect.objectContaining({ name: 'notification' }),
        ]),
      );
    });
  });

  describe('addPushJob', () => {
    it('should add push notification job to queue', async () => {
      // Arrange
      const pushData = {
        userId,
        title: 'New Message',
        body: 'You have a new message',
        data: { type: 'message', conversationId: 'conv-123' },
      };

      // Act
      const result = await service.addPushJob(pushData);

      // Assert
      expect(result.id).toBe(jobId);
      expect(mockPushQueue.add).toHaveBeenCalledWith(
        'push',
        pushData,
        expect.objectContaining({
          priority: expect.any(Number),
        }),
      );
    });
  });

  describe('addCleanupJob', () => {
    it('should add cleanup job to queue', async () => {
      // Act
      const result = await service.addCleanupJob(CLEANUP_JOBS.EXPIRED_STORIES);

      // Assert
      expect(result.id).toBe(jobId);
      expect(mockCleanupQueue.add).toHaveBeenCalledWith(
        CLEANUP_JOBS.EXPIRED_STORIES,
        expect.objectContaining({ type: CLEANUP_JOBS.EXPIRED_STORIES }),
        expect.any(Object),
      );
    });

    it('should allow custom data in cleanup job', async () => {
      // Arrange
      const customData = { params: { olderThanDays: 60 } };

      // Act
      await service.addCleanupJob(CLEANUP_JOBS.OLD_NOTIFICATIONS, customData);

      // Assert
      expect(mockCleanupQueue.add).toHaveBeenCalledWith(
        CLEANUP_JOBS.OLD_NOTIFICATIONS,
        expect.objectContaining({
          type: CLEANUP_JOBS.OLD_NOTIFICATIONS,
          params: { olderThanDays: 60 },
        }),
        expect.any(Object),
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status from notifications queue', async () => {
      // Arrange
      const mockJob = {
        progress: 50,
        attemptsMade: 2,
        failedReason: undefined,
        getState: vi.fn().mockResolvedValue('active'),
      };
      mockNotificationsQueue.getJob.mockResolvedValue(mockJob);

      // Act
      const result = await service.getJobStatus(
        QUEUE_NAMES.NOTIFICATIONS,
        jobId,
      );

      // Assert
      expect(result).toEqual({
        state: 'active',
        progress: 50,
        attemptsMade: 2,
        failedReason: undefined,
      });
    });

    it('should return null for non-existent job', async () => {
      // Act
      const result = await service.getJobStatus(
        QUEUE_NAMES.PUSH,
        'non-existent',
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for unknown queue', async () => {
      // Act
      const result = await service.getJobStatus('unknown-queue', jobId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      // Act
      const result = await service.getQueueStats(QUEUE_NAMES.NOTIFICATIONS);

      // Assert
      expect(result).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      });
    });

    it('should return null for unknown queue', async () => {
      // Act
      const result = await service.getQueueStats('unknown-queue');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getAllQueuesStats', () => {
    it('should return stats for all queues', async () => {
      // Act
      const result = await service.getAllQueuesStats();

      // Assert
      expect(result).toHaveProperty(QUEUE_NAMES.NOTIFICATIONS);
      expect(result).toHaveProperty(QUEUE_NAMES.PUSH);
      expect(result).toHaveProperty(QUEUE_NAMES.CLEANUP);
    });
  });

  describe('retryFailedJobs', () => {
    it('should retry failed jobs in queue', async () => {
      // Arrange
      const mockFailedJobs = [
        { retry: vi.fn().mockResolvedValue(undefined) },
        { retry: vi.fn().mockResolvedValue(undefined) },
      ];
      mockPushQueue.getFailed.mockResolvedValue(mockFailedJobs);

      // Act
      const result = await service.retryFailedJobs(QUEUE_NAMES.PUSH);

      // Assert
      expect(result).toBe(2);
      expect(mockFailedJobs[0].retry).toHaveBeenCalled();
      expect(mockFailedJobs[1].retry).toHaveBeenCalled();
    });

    it('should return 0 for unknown queue', async () => {
      // Act
      const result = await service.retryFailedJobs('unknown-queue');

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('clearQueue', () => {
    it('should clear completed jobs from queue', async () => {
      // Act
      await service.clearQueue(QUEUE_NAMES.CLEANUP, 'completed');

      // Assert
      expect(mockCleanupQueue.clean).toHaveBeenCalledWith(0, 0, 'completed');
    });

    it('should clear failed jobs from queue', async () => {
      // Act
      await service.clearQueue(QUEUE_NAMES.PUSH, 'failed');

      // Assert
      expect(mockPushQueue.clean).toHaveBeenCalledWith(0, 0, 'failed');
    });

    it('should do nothing for unknown queue', async () => {
      // Act
      await service.clearQueue('unknown-queue', 'completed');

      // Assert
      expect(mockNotificationsQueue.clean).not.toHaveBeenCalled();
      expect(mockPushQueue.clean).not.toHaveBeenCalled();
      expect(mockCleanupQueue.clean).not.toHaveBeenCalled();
    });
  });
});
