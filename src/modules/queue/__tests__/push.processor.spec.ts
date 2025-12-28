import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { PushProcessor } from '../processors/push.processor.js';
import { Job } from 'bullmq';

describe('PushProcessor', () => {
  let processor: PushProcessor;
  let mockFCMService: Record<string, Mock>;
  let mockDeviceTokensService: Record<string, Mock>;

  const userId = 'user-uuid-1234';
  const jobId = 'job-uuid-5678';
  const tokens = ['token-1', 'token-2'];

  const mockPushData = {
    userId,
    title: 'New Message',
    body: 'You have a new message from John',
    data: {
      type: 'message',
      conversationId: 'conv-123',
    },
  };

  const createMockJob = (data: any, options: Partial<Job> = {}): Job =>
    ({
      id: jobId,
      data,
      attemptsMade: 0,
      opts: { attempts: 3 },
      ...options,
    }) as unknown as Job;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFCMService = {
      isAvailable: vi.fn().mockReturnValue(true),
      sendToTokens: vi.fn().mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        failedTokens: [],
      }),
    };

    mockDeviceTokensService = {
      getActiveTokens: vi.fn().mockResolvedValue(tokens),
    };

    processor = new PushProcessor(
      mockFCMService as any,
      mockDeviceTokensService as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('process', () => {
    it('should send push notification successfully', async () => {
      // Arrange
      const job = createMockJob(mockPushData);

      // Act
      const result = await processor.process(job);

      // Assert
      expect(result).toEqual({
        successCount: 2,
        failureCount: 0,
        invalidTokens: [],
      });
      expect(mockDeviceTokensService.getActiveTokens).toHaveBeenCalledWith(
        userId,
      );
      expect(mockFCMService.sendToTokens).toHaveBeenCalledWith(
        tokens,
        expect.objectContaining({
          title: mockPushData.title,
          body: mockPushData.body,
          data: mockPushData.data,
        }),
      );
    });

    it('should use provided tokens instead of fetching', async () => {
      // Arrange
      const providedTokens = ['custom-token-1'];
      const job = createMockJob({ ...mockPushData, tokens: providedTokens });

      // Act
      await processor.process(job);

      // Assert
      expect(mockDeviceTokensService.getActiveTokens).not.toHaveBeenCalled();
      expect(mockFCMService.sendToTokens).toHaveBeenCalledWith(
        providedTokens,
        expect.any(Object),
      );
    });

    it('should skip if FCM is not available', async () => {
      // Arrange
      mockFCMService.isAvailable.mockReturnValue(false);
      const job = createMockJob(mockPushData);

      // Act
      const result = await processor.process(job);

      // Assert
      expect(result).toEqual({
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
      });
      expect(mockFCMService.sendToTokens).not.toHaveBeenCalled();
    });

    it('should return empty result if no device tokens', async () => {
      // Arrange
      mockDeviceTokensService.getActiveTokens.mockResolvedValue([]);
      const job = createMockJob(mockPushData);

      // Act
      const result = await processor.process(job);

      // Assert
      expect(result).toEqual({
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
      });
      expect(mockFCMService.sendToTokens).not.toHaveBeenCalled();
    });

    it('should handle partial failure', async () => {
      // Arrange
      mockFCMService.sendToTokens.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        failedTokens: ['token-2'],
      });
      const job = createMockJob(mockPushData);

      // Act
      const result = await processor.process(job);

      // Assert
      expect(result).toEqual({
        successCount: 1,
        failureCount: 1,
        invalidTokens: ['token-2'],
      });
    });

    it('should include optional fields when provided', async () => {
      // Arrange
      const dataWithOptional = {
        ...mockPushData,
        badge: 5,
        sound: 'notification.mp3',
        imageUrl: 'https://example.com/image.png',
      };
      const job = createMockJob(dataWithOptional);

      // Act
      await processor.process(job);

      // Assert
      expect(mockFCMService.sendToTokens).toHaveBeenCalledWith(
        tokens,
        expect.objectContaining({
          badge: 5,
          sound: 'notification.mp3',
          imageUrl: 'https://example.com/image.png',
        }),
      );
    });

    it('should throw error on FCM failure', async () => {
      // Arrange
      mockFCMService.sendToTokens.mockRejectedValue(new Error('FCM error'));
      const job = createMockJob(mockPushData);

      // Act & Assert
      await expect(processor.process(job)).rejects.toThrow('FCM error');
    });
  });

  describe('onCompleted', () => {
    it('should log completion', () => {
      // Arrange
      const job = createMockJob(mockPushData);
      const result = { successCount: 2, failureCount: 0, invalidTokens: [] };

      // Act - should not throw
      expect(() => processor.onCompleted(job, result)).not.toThrow();
    });
  });

  describe('onFailed', () => {
    it('should log failure', () => {
      // Arrange
      const job = createMockJob(mockPushData);
      const error = new Error('Test error');

      // Act - should not throw
      expect(() => processor.onFailed(job, error)).not.toThrow();
    });

    it('should log permanent failure when retries exhausted', () => {
      // Arrange
      const job = createMockJob(mockPushData, {
        attemptsMade: 3,
        opts: { attempts: 3 },
      });
      const error = new Error('Permanent failure');

      // Act - should not throw
      expect(() => processor.onFailed(job, error)).not.toThrow();
    });
  });
});
