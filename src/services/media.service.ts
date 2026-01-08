import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from '../config/r2';
import { AppError } from '../middleware/error-handler';
import crypto from 'crypto';
import path from 'path';

export type MediaFolder = 'avatars' | 'covers' | 'posts' | 'stories' | 'listings' | 'services' | 'forum';

interface UploadResult {
  key: string;
  url: string;
}

/**
 * Generate unique filename for uploaded file
 */
function generateFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const uniqueId = crypto.randomUUID();
  const timestamp = Date.now();
  return `${timestamp}-${uniqueId}${ext}`;
}

/**
 * Get content type from file extension
 */
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Upload a file to R2
 */
export async function uploadFile(
  file: Express.Multer.File,
  folder: MediaFolder,
  userId?: string
): Promise<UploadResult> {
  const fileName = generateFileName(file.originalname);
  const key = userId ? `${folder}/${userId}/${fileName}` : `${folder}/${fileName}`;

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: getContentType(file.originalname),
      })
    );

    const url = `${R2_PUBLIC_URL}/${key}`;
    return { key, url };
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new AppError(500, 'UPLOAD_FAILED', 'Failed to upload file');
  }
}

/**
 * Upload multiple files to R2
 */
export async function uploadFiles(
  files: Express.Multer.File[],
  folder: MediaFolder,
  userId?: string
): Promise<UploadResult[]> {
  const uploadPromises = files.map((file) => uploadFile(file, folder, userId));
  return Promise.all(uploadPromises);
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );
  } catch (error) {
    console.error('R2 delete error:', error);
    // Don't throw - file might not exist
  }
}

/**
 * Delete multiple files from R2
 */
export async function deleteFiles(keys: string[]): Promise<void> {
  const deletePromises = keys.map((key) => deleteFile(key));
  await Promise.all(deletePromises);
}

/**
 * Extract key from full URL
 */
export function extractKeyFromUrl(url: string): string | null {
  if (!url || !R2_PUBLIC_URL) return null;

  if (url.startsWith(R2_PUBLIC_URL)) {
    return url.replace(`${R2_PUBLIC_URL}/`, '');
  }
  return null;
}

/**
 * Upload avatar and return URL (deletes old avatar if exists)
 */
export async function uploadAvatar(
  file: Express.Multer.File,
  userId: string,
  oldAvatarUrl?: string | null
): Promise<string> {
  // Delete old avatar if exists
  if (oldAvatarUrl) {
    const oldKey = extractKeyFromUrl(oldAvatarUrl);
    if (oldKey) {
      await deleteFile(oldKey);
    }
  }

  const result = await uploadFile(file, 'avatars', userId);
  return result.url;
}

/**
 * Upload cover and return URL (deletes old cover if exists)
 */
export async function uploadCover(
  file: Express.Multer.File,
  userId: string,
  oldCoverUrl?: string | null
): Promise<string> {
  // Delete old cover if exists
  if (oldCoverUrl) {
    const oldKey = extractKeyFromUrl(oldCoverUrl);
    if (oldKey) {
      await deleteFile(oldKey);
    }
  }

  const result = await uploadFile(file, 'covers', userId);
  return result.url;
}
