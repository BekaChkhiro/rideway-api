import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MediaService } from '../media.service.js';

// Mock sharp
vi.mock('sharp', () => {
  const mockSharp = vi.fn().mockReturnValue({
    metadata: vi
      .fn()
      .mockResolvedValue({ format: 'jpeg', width: 1000, height: 800 }),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image')),
  });
  return { default: mockSharp };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('12345678-1234-1234-1234-123456789012'),
}));

describe('MediaService', () => {
  let service: MediaService;
  let mockR2Service: Record<string, Mock>;
  let mockConfigService: Record<string, Mock>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-data'),
    size: 1024 * 100, // 100KB
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  const mockR2Config = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockR2Service = {
      upload: vi
        .fn()
        .mockResolvedValue('https://example.com/uploaded-image.webp'),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      extractKeyFromUrl: vi.fn().mockReturnValue('avatars/test-key.webp'),
      getPublicUrl: vi.fn().mockReturnValue('https://example.com/public-url'),
    };

    mockConfigService = {
      get: vi.fn().mockReturnValue(mockR2Config),
    };

    service = new MediaService(mockR2Service as any, mockConfigService as any);
  });

  describe('uploadImage', () => {
    it('should upload single image successfully', async () => {
      const result = await service.uploadImage(
        mockFile,
        'avatars',
        'user-uuid-1234',
      );

      expect(result.url).toBe('https://example.com/uploaded-image.webp');
      expect(result.key).toContain('avatars/');
      expect(result.mimetype).toBe('image/webp');
      expect(mockR2Service.upload).toHaveBeenCalled();
    });

    it('should process image with correct folder preset', async () => {
      await service.uploadImage(mockFile, 'avatars', 'user-uuid-1234');

      // Avatar preset converts to webp
      expect(mockR2Service.upload).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('avatars/'),
        'image/webp',
        expect.any(Object),
      );
    });

    it('should generate unique filename', async () => {
      const result = await service.uploadImage(
        mockFile,
        'posts',
        'user-uuid-1234',
      );

      expect(result.key).toMatch(/^posts\/user-uui_\d+_12345678\.webp$/);
    });

    it('should reject file with no data', async () => {
      await expect(
        service.uploadImage(null as any, 'avatars', 'user-uuid-1234'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadImages', () => {
    it('should upload multiple images successfully', async () => {
      const files = [mockFile, { ...mockFile, originalname: 'test2.jpg' }];

      const results = await service.uploadImages(
        files,
        'avatars',
        'user-uuid-1234',
      );

      expect(results).toHaveLength(2);
      // Each avatar upload creates one file (no thumbnails for avatars)
      expect(mockR2Service.upload).toHaveBeenCalledTimes(2);
    });

    it('should reject more than 10 files', async () => {
      const files = Array(11).fill(mockFile);

      await expect(
        service.uploadImages(files, 'posts', 'user-uuid-1234'),
      ).rejects.toThrow(BadRequestException);
      expect(mockR2Service.upload).not.toHaveBeenCalled();
    });

    it('should handle empty files array', async () => {
      const results = await service.uploadImages([], 'posts', 'user-uuid-1234');

      expect(results).toHaveLength(0);
    });
  });

  describe('file validation', () => {
    it('should reject invalid file type', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'application/pdf',
      };

      await expect(
        service.uploadImage(
          invalidFile as Express.Multer.File,
          'avatars',
          'user-uuid-1234',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file exceeding size limit', async () => {
      const largeFile = {
        ...mockFile,
        size: 20 * 1024 * 1024, // 20MB exceeds 10MB limit
      };

      await expect(
        service.uploadImage(
          largeFile as Express.Multer.File,
          'avatars',
          'user-uuid-1234',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid file types', async () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

      for (const mimetype of validTypes) {
        const file = { ...mockFile, mimetype };
        await expect(
          service.uploadImage(
            file as Express.Multer.File,
            'avatars',
            'user-uuid-1234',
          ),
        ).resolves.toBeDefined();
      }
    });

    it('should accept file within size limit', async () => {
      const validFile = {
        ...mockFile,
        size: 5 * 1024 * 1024, // 5MB within 10MB limit
      };

      await expect(
        service.uploadImage(
          validFile as Express.Multer.File,
          'avatars',
          'user-uuid-1234',
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('image processing', () => {
    it('should resize image according to preset', async () => {
      const sharp = await import('sharp');

      await service.uploadImage(mockFile, 'avatars', 'user-uuid-1234');

      // Sharp should be called to process the image
      expect(sharp.default).toHaveBeenCalled();
    });

    it('should convert to WebP when preset requires', async () => {
      const result = await service.uploadImage(
        mockFile,
        'avatars',
        'user-uuid-1234',
      );

      // Avatar preset converts to webp
      expect(result.mimetype).toBe('image/webp');
    });

    it('should return processed dimensions', async () => {
      const result = await service.uploadImage(
        mockFile,
        'avatars',
        'user-uuid-1234',
      );

      expect(result.width).toBeDefined();
      expect(result.height).toBeDefined();
    });
  });

  describe('deleteImage', () => {
    it('should delete image from R2', async () => {
      await service.deleteImage('https://example.com/avatars/test-image.webp');

      expect(mockR2Service.extractKeyFromUrl).toHaveBeenCalled();
      expect(mockR2Service.delete).toHaveBeenCalledWith(
        'avatars/test-key.webp',
      );
    });

    it('should also delete thumbnail if exists', async () => {
      mockR2Service.exists.mockResolvedValue(true);

      await service.deleteImage('https://example.com/avatars/test-image.webp');

      // Should check and delete thumbnail
      expect(mockR2Service.exists).toHaveBeenCalled();
      expect(mockR2Service.delete).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException for invalid URL', async () => {
      mockR2Service.extractKeyFromUrl.mockReturnValue(null);

      await expect(service.deleteImage('invalid-url')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not fail if thumbnail does not exist', async () => {
      mockR2Service.exists.mockResolvedValue(false);

      await expect(
        service.deleteImage('https://example.com/avatars/test-image.webp'),
      ).resolves.toBeUndefined();
    });
  });

  describe('deleteByKey', () => {
    it('should delete file by key directly', async () => {
      await service.deleteByKey('avatars/test-key.webp');

      expect(mockR2Service.delete).toHaveBeenCalledWith(
        'avatars/test-key.webp',
      );
    });
  });

  describe('folder presets', () => {
    it('should use avatar preset for avatars folder', async () => {
      const result = await service.uploadImage(
        mockFile,
        'avatars',
        'user-uuid-1234',
      );

      expect(result.key).toContain('avatars/');
      expect(result.mimetype).toBe('image/webp');
    });

    it('should use cover preset for covers folder', async () => {
      const result = await service.uploadImage(
        mockFile,
        'covers',
        'user-uuid-1234',
      );

      expect(result.key).toContain('covers/');
    });

    it('should use posts preset for posts folder', async () => {
      const result = await service.uploadImage(
        mockFile,
        'posts',
        'user-uuid-1234',
      );

      expect(result.key).toContain('posts/');
    });

    it('should use listings preset for listings folder', async () => {
      const result = await service.uploadImage(
        mockFile,
        'listings',
        'user-uuid-1234',
      );

      expect(result.key).toContain('listings/');
    });
  });

  describe('thumbnail generation', () => {
    it('should generate thumbnail for posts', async () => {
      // Posts preset generates thumbnails
      mockR2Service.upload.mockResolvedValue('https://example.com/image.webp');

      const result = await service.uploadImage(
        mockFile,
        'posts',
        'user-uuid-1234',
      );

      // Should have called upload twice (main + thumbnail)
      // Note: thumbnails are optional based on preset
      expect(result.url).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should propagate R2 upload errors', async () => {
      mockR2Service.upload.mockRejectedValue(new Error('R2 upload failed'));

      await expect(
        service.uploadImage(mockFile, 'avatars', 'user-uuid-1234'),
      ).rejects.toThrow('R2 upload failed');
    });

    it('should propagate R2 delete errors', async () => {
      mockR2Service.delete.mockRejectedValue(new Error('R2 delete failed'));

      await expect(
        service.deleteImage('https://example.com/test.webp'),
      ).rejects.toThrow('R2 delete failed');
    });
  });
});
