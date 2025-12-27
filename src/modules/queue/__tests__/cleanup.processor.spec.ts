import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { CleanupProcessor } from '../processors/cleanup.processor.js';
import { CLEANUP_JOBS } from '../interfaces/job-data.interface.js';
import { Job } from 'bullmq';

describe('CleanupProcessor', () => {
  let processor: CleanupProcessor;
  let mockNotificationsService: Record<string, Mock>;

  const jobId = 'job-uuid-1234';

  const createMockJob = (name: string, data: any = {}, options: Partial<Job> = {}): Job => ({
    id: jobId,
    name,
    data: { type: name, ...data },
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...options,
  } as unknown as Job);

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotificationsService = {
      deleteOld: vi.fn().mockResolvedValue(25),
    };

    processor = new CleanupProcessor(mockNotificationsService as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('process', () => {
    describe('expired-stories', () => {
      it('should handle expired stories cleanup', async () => {
        // Arrange
        const job = createMockJob(CLEANUP_JOBS.EXPIRED_STORIES);

        // Act
        const result = await processor.process(job);

        // Assert - placeholder returns 0
        expect(result).toEqual({ deletedCount: 0 });
      });
    });

    describe('old-notifications', () => {
      it('should delete old notifications with default days', async () => {
        // Arrange
        const job = createMockJob(CLEANUP_JOBS.OLD_NOTIFICATIONS);

        // Act
        const result = await processor.process(job);

        // Assert
        expect(result).toEqual({ deletedCount: 25 });
        expect(mockNotificationsService.deleteOld).toHaveBeenCalledWith(30);
      });

      it('should use custom olderThanDays parameter', async () => {
        // Arrange
        const job = createMockJob(CLEANUP_JOBS.OLD_NOTIFICATIONS, {
          params: { olderThanDays: 60 },
        });

        // Act
        await processor.process(job);

        // Assert
        expect(mockNotificationsService.deleteOld).toHaveBeenCalledWith(60);
      });

      it('should handle notification cleanup error', async () => {
        // Arrange
        mockNotificationsService.deleteOld.mockRejectedValue(new Error('DB error'));
        const job = createMockJob(CLEANUP_JOBS.OLD_NOTIFICATIONS);

        // Act
        const result = await processor.process(job);

        // Assert
        expect(result).toEqual({
          deletedCount: 0,
          errors: ['DB error'],
        });
      });
    });

    describe('inactive-tokens', () => {
      it('should handle inactive tokens cleanup', async () => {
        // Arrange
        const job = createMockJob(CLEANUP_JOBS.INACTIVE_TOKENS);

        // Act
        const result = await processor.process(job);

        // Assert - placeholder returns 0
        expect(result).toEqual({ deletedCount: 0 });
      });
    });

    describe('orphaned-media', () => {
      it('should handle orphaned media cleanup', async () => {
        // Arrange
        const job = createMockJob(CLEANUP_JOBS.ORPHANED_MEDIA);

        // Act
        const result = await processor.process(job);

        // Assert - placeholder returns 0
        expect(result).toEqual({ deletedCount: 0 });
      });
    });

    describe('unknown job type', () => {
      it('should handle unknown job type', async () => {
        // Arrange
        const job = createMockJob('unknown-cleanup-type');

        // Act
        const result = await processor.process(job);

        // Assert
        expect(result).toEqual({
          deletedCount: 0,
          errors: ['Unknown job type: unknown-cleanup-type'],
        });
      });
    });
  });

  describe('onCompleted', () => {
    it('should log completion with deleted count', () => {
      // Arrange
      const job = createMockJob(CLEANUP_JOBS.OLD_NOTIFICATIONS);
      const result = { deletedCount: 50 };

      // Act - should not throw
      expect(() => processor.onCompleted(job, result)).not.toThrow();
    });

    it('should log zero deleted count', () => {
      // Arrange
      const job = createMockJob(CLEANUP_JOBS.EXPIRED_STORIES);
      const result = { deletedCount: 0 };

      // Act - should not throw
      expect(() => processor.onCompleted(job, result)).not.toThrow();
    });
  });

  describe('onFailed', () => {
    it('should log failure with error', () => {
      // Arrange
      const job = createMockJob(CLEANUP_JOBS.OLD_NOTIFICATIONS);
      const error = new Error('Cleanup failed');
      error.stack = 'Error stack trace';

      // Act - should not throw
      expect(() => processor.onFailed(job, error)).not.toThrow();
    });
  });
});
