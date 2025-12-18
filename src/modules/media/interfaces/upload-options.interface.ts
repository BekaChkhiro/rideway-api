export type ImageFolder =
  | 'avatars'
  | 'covers'
  | 'posts'
  | 'listings'
  | 'thumbnails'
  | 'general';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageProcessingOptions {
  folder: ImageFolder;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  convertToWebp?: boolean;
  generateThumbnail?: boolean;
  thumbnailSize?: ImageDimensions;
}

export interface UploadOptions {
  folder: ImageFolder;
  userId: string;
  filename?: string;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimetype: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export const IMAGE_PRESETS: Record<ImageFolder, ImageProcessingOptions> = {
  avatars: {
    folder: 'avatars',
    maxWidth: 200,
    maxHeight: 200,
    quality: 80,
    convertToWebp: true,
    generateThumbnail: false,
  },
  covers: {
    folder: 'covers',
    maxWidth: 1200,
    maxHeight: 400,
    quality: 85,
    convertToWebp: true,
    generateThumbnail: false,
  },
  posts: {
    folder: 'posts',
    maxWidth: 1080,
    quality: 85,
    convertToWebp: true,
    generateThumbnail: true,
    thumbnailSize: { width: 300, height: 300 },
  },
  listings: {
    folder: 'listings',
    maxWidth: 1200,
    quality: 85,
    convertToWebp: true,
    generateThumbnail: true,
    thumbnailSize: { width: 300, height: 300 },
  },
  thumbnails: {
    folder: 'thumbnails',
    maxWidth: 300,
    maxHeight: 300,
    quality: 75,
    convertToWebp: true,
    generateThumbnail: false,
  },
  general: {
    folder: 'general',
    maxWidth: 1920,
    quality: 85,
    convertToWebp: true,
    generateThumbnail: false,
  },
};
