import { Request, Response } from 'express';
import { MediaType } from '@prisma/client';
import * as storiesService from '../services/stories.service';
import { CreateStoryInput, StoryViewsQuery } from '../validators/stories';
import { AppError } from '../middleware/error-handler';

// POST /stories - Create a new story
export async function createStory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const file = req.file;

  if (!file) {
    throw new AppError(400, 'FILE_REQUIRED', 'Story media file is required');
  }

  const { mediaType } = req.body as CreateStoryInput;
  const type: MediaType = mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE';

  const story = await storiesService.createStory(userId, file, type);

  res.status(201).json({
    success: true,
    data: story,
  });
}

// GET /stories - Get feed stories (grouped by user)
export async function getFeedStories(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const stories = await storiesService.getFeedStories(userId);

  res.json({
    success: true,
    data: stories,
  });
}

// GET /stories/me - Get my active stories
export async function getMyStories(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const stories = await storiesService.getMyStories(userId);

  res.json({
    success: true,
    data: stories,
  });
}

// GET /stories/user/:userId - Get user's active stories
export async function getUserStories(req: Request, res: Response): Promise<void> {
  const { userId: targetUserId } = req.params;
  const currentUserId = req.user?.userId;

  const stories = await storiesService.getUserStories(targetUserId, currentUserId);

  res.json({
    success: true,
    data: stories,
  });
}

// GET /stories/:id - Get a single story
export async function getStory(req: Request, res: Response): Promise<void> {
  const { id: storyId } = req.params;
  const currentUserId = req.user?.userId;

  const story = await storiesService.getStoryById(storyId, currentUserId);

  res.json({
    success: true,
    data: story,
  });
}

// POST /stories/:id/view - Mark story as viewed
export async function viewStory(req: Request, res: Response): Promise<void> {
  const { id: storyId } = req.params;
  const userId = req.user!.userId;

  await storiesService.viewStory(storyId, userId);

  res.json({
    success: true,
    message: 'Story viewed',
  });
}

// GET /stories/:id/viewers - Get story viewers (owner only)
export async function getStoryViewers(req: Request, res: Response): Promise<void> {
  const { id: storyId } = req.params;
  const userId = req.user!.userId;
  const { page, limit } = req.query as unknown as StoryViewsQuery;

  const result = await storiesService.getStoryViewers(storyId, userId, page, limit);

  res.json({
    success: true,
    data: result.items,
    meta: result.meta,
  });
}

// DELETE /stories/:id - Delete a story
export async function deleteStory(req: Request, res: Response): Promise<void> {
  const { id: storyId } = req.params;
  const userId = req.user!.userId;

  await storiesService.deleteStory(storyId, userId);

  res.json({
    success: true,
    message: 'Story deleted',
  });
}
