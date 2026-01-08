import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import * as mediaService from '../services/media.service';
import { AppError } from '../middleware/error-handler';
import { prisma } from '../config/database';

/**
 * Upload avatar
 * PATCH /api/v1/media/avatar
 */
export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  if (!req.file) {
    throw new AppError(400, 'NO_FILE', 'No file uploaded');
  }

  // Get current user to check old avatar
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  // Upload new avatar
  const avatarUrl = await mediaService.uploadAvatar(req.file, userId, user?.avatarUrl);

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
    },
  });

  res.json({
    success: true,
    data: updatedUser,
  });
});

/**
 * Upload cover
 * PATCH /api/v1/media/cover
 */
export const uploadCover = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  if (!req.file) {
    throw new AppError(400, 'NO_FILE', 'No file uploaded');
  }

  // Get current user to check old cover
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coverUrl: true },
  });

  // Upload new cover
  const coverUrl = await mediaService.uploadCover(req.file, userId, user?.coverUrl);

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { coverUrl },
    select: {
      id: true,
      username: true,
      coverUrl: true,
    },
  });

  res.json({
    success: true,
    data: updatedUser,
  });
});

/**
 * Delete avatar
 * DELETE /api/v1/media/avatar
 */
export const deleteAvatar = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  // Delete from R2 if exists
  if (user?.avatarUrl) {
    const key = mediaService.extractKeyFromUrl(user.avatarUrl);
    if (key) {
      await mediaService.deleteFile(key);
    }
  }

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
  });

  res.json({
    success: true,
    data: { message: 'Avatar deleted' },
  });
});

/**
 * Delete cover
 * DELETE /api/v1/media/cover
 */
export const deleteCover = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coverUrl: true },
  });

  // Delete from R2 if exists
  if (user?.coverUrl) {
    const key = mediaService.extractKeyFromUrl(user.coverUrl);
    if (key) {
      await mediaService.deleteFile(key);
    }
  }

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: { coverUrl: null },
  });

  res.json({
    success: true,
    data: { message: 'Cover deleted' },
  });
});
