import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { R2Service } from './r2.service.js';
import type { R2Config } from '@config/r2.config';
import {
  type ImageFolder,
  type ImageProcessingOptions,
  type UploadResult,
  IMAGE_PRESETS,
} from './interfaces/upload-options.interface.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    @Inject(R2Service) private readonly r2Service: R2Service,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    const r2Config = this.configService.get<R2Config>('r2');
    this.maxFileSize = r2Config?.maxFileSize || 10485760;
    this.allowedMimeTypes = r2Config?.allowedMimeTypes || [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: ImageFolder,
    userId: string,
  ): Promise<UploadResult> {
    // Validate file
    this.validateFile(file);

    const options = IMAGE_PRESETS[folder];
    const processedImage = await this.processImage(file.buffer, options);

    // Generate unique filename
    const filename = this.generateFilename(
      userId,
      options.convertToWebp ? 'webp' : this.getExtension(file.mimetype),
    );
    const key = `${folder}/${filename}`;

    // Upload main image
    const url = await this.r2Service.upload(
      processedImage.buffer,
      key,
      options.convertToWebp ? 'image/webp' : file.mimetype,
      { userId, originalName: file.originalname },
    );

    const result: UploadResult = {
      url,
      key,
      size: processedImage.buffer.length,
      mimetype: options.convertToWebp ? 'image/webp' : file.mimetype,
      width: processedImage.width,
      height: processedImage.height,
    };

    // Generate thumbnail if needed
    if (options.generateThumbnail && options.thumbnailSize) {
      const thumbnail = await this.generateThumbnail(
        file.buffer,
        options.thumbnailSize.width,
        options.thumbnailSize.height,
      );
      const thumbnailKey = `thumbnails/${filename}`;
      const thumbnailUrl = await this.r2Service.upload(
        thumbnail,
        thumbnailKey,
        'image/webp',
        { userId, type: 'thumbnail' },
      );
      result.thumbnailUrl = thumbnailUrl;
    }

    this.logger.log(`Image uploaded: ${key} for user ${userId}`);
    return result;
  }

  async uploadImages(
    files: Express.Multer.File[],
    folder: ImageFolder,
    userId: string,
  ): Promise<UploadResult[]> {
    if (files.length > 10) {
      throw new BadRequestException('Maximum 10 files allowed per upload');
    }

    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await this.uploadImage(file, folder, userId);
      results.push(result);
    }

    return results;
  }

  async deleteImage(url: string): Promise<void> {
    const key = this.r2Service.extractKeyFromUrl(url);
    if (!key) {
      throw new BadRequestException('Invalid URL');
    }

    await this.r2Service.delete(key);

    // Also try to delete thumbnail if exists
    const thumbnailKey = key.replace(/^[^/]+\//, 'thumbnails/');
    const thumbnailExists = await this.r2Service.exists(thumbnailKey);
    if (thumbnailExists) {
      await this.r2Service.delete(thumbnailKey);
    }

    this.logger.log(`Image deleted: ${key}`);
  }

  async deleteByKey(key: string): Promise<void> {
    await this.r2Service.delete(key);
    this.logger.log(`File deleted by key: ${key}`);
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  private async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions,
  ): Promise<{ buffer: Buffer; width: number; height: number }> {
    let image = sharp(buffer);

    // Get original metadata
    const metadata = await image.metadata();

    // Resize if needed
    if (options.maxWidth || options.maxHeight) {
      image = image.resize({
        width: options.maxWidth,
        height: options.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to WebP if requested
    if (options.convertToWebp) {
      image = image.webp({ quality: options.quality || 85 });
    } else {
      // Apply quality settings based on original format
      const format = metadata.format;
      if (format === 'jpeg' || format === 'jpg') {
        image = image.jpeg({ quality: options.quality || 85 });
      } else if (format === 'png') {
        image = image.png({ quality: options.quality || 85 });
      }
    }

    const processedBuffer = await image.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: processedMetadata.width || 0,
      height: processedMetadata.height || 0,
    };
  }

  private async generateThumbnail(
    buffer: Buffer,
    width: number,
    height: number,
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize({
        width,
        height,
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 75 })
      .toBuffer();
  }

  private generateFilename(userId: string, extension: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    return `${userId.substring(0, 8)}_${timestamp}_${uuid}.${extension}`;
  }

  private getExtension(mimetype: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    return mimeToExt[mimetype] || 'jpg';
  }
}
