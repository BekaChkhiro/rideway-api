import { prisma } from '../config/database';
import { AppError } from '../middleware/error-handler';
import { uploadFile, deleteFile, deleteFiles, extractKeyFromUrl } from './media.service';
import { MediaType } from '@prisma/client';

const STORY_EXPIRY_HOURS = 24;

interface StoryAuthor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface StoryResponse {
  id: string;
  mediaUrl: string;
  mediaType: MediaType;
  viewCount: number;
  author: StoryAuthor;
  isViewed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

interface StoryViewerResponse {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  viewedAt: Date;
}

interface UserStoriesGroup {
  user: StoryAuthor;
  stories: Omit<StoryResponse, 'author'>[];
  hasUnviewed: boolean;
}

interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Create a new story
export async function createStory(
  userId: string,
  file: Express.Multer.File,
  mediaType: MediaType = 'IMAGE'
): Promise<StoryResponse> {
  // Upload file to R2
  const result = await uploadFile(file, 'stories', userId);
  const mediaUrl = result.url;

  // Calculate expiry time (24 hours from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + STORY_EXPIRY_HOURS);

  const story = await prisma.story.create({
    data: {
      userId,
      mediaUrl,
      mediaType,
      expiresAt,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return {
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    viewCount: story.viewCount,
    author: story.user,
    isViewed: false, // Own story, not applicable
    expiresAt: story.expiresAt,
    createdAt: story.createdAt,
  };
}

// Get a single story by ID
export async function getStoryById(
  storyId: string,
  currentUserId?: string
): Promise<StoryResponse> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      views: currentUserId
        ? {
            where: { userId: currentUserId },
            take: 1,
          }
        : false,
    },
  });

  if (!story) {
    throw new AppError(404, 'STORY_NOT_FOUND', 'Story not found');
  }

  // Check if expired
  if (story.expiresAt < new Date()) {
    throw new AppError(410, 'STORY_EXPIRED', 'This story has expired');
  }

  return {
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    viewCount: story.viewCount,
    author: story.user,
    isViewed: Array.isArray(story.views) && story.views.length > 0,
    expiresAt: story.expiresAt,
    createdAt: story.createdAt,
  };
}

// View a story (mark as viewed)
export async function viewStory(storyId: string, userId: string): Promise<void> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!story) {
    throw new AppError(404, 'STORY_NOT_FOUND', 'Story not found');
  }

  if (story.expiresAt < new Date()) {
    throw new AppError(410, 'STORY_EXPIRED', 'This story has expired');
  }

  // Don't count own view
  if (story.userId === userId) {
    return;
  }

  // Upsert view (ignore if already viewed)
  await prisma.$transaction([
    prisma.storyView.upsert({
      where: {
        storyId_userId: {
          storyId,
          userId,
        },
      },
      create: {
        storyId,
        userId,
      },
      update: {}, // Do nothing if exists
    }),
    // Increment view count only for new views
    prisma.story.update({
      where: { id: storyId },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    }),
  ]);
}

// Get story viewers (only story owner can see)
export async function getStoryViewers(
  storyId: string,
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResult<StoryViewerResponse>> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { userId: true },
  });

  if (!story) {
    throw new AppError(404, 'STORY_NOT_FOUND', 'Story not found');
  }

  if (story.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view viewers of your own stories');
  }

  const skip = (page - 1) * limit;

  const [views, total] = await Promise.all([
    prisma.storyView.findMany({
      where: { storyId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.storyView.count({ where: { storyId } }),
  ]);

  return {
    items: views.map((view) => ({
      id: view.user.id,
      username: view.user.username,
      fullName: view.user.fullName,
      avatarUrl: view.user.avatarUrl,
      viewedAt: view.createdAt,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Delete a story
export async function deleteStory(storyId: string, userId: string): Promise<void> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, userId: true, mediaUrl: true },
  });

  if (!story) {
    throw new AppError(404, 'STORY_NOT_FOUND', 'Story not found');
  }

  if (story.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own stories');
  }

  // Delete from R2
  const key = extractKeyFromUrl(story.mediaUrl);
  if (key) {
    await deleteFiles([key]);
  }

  // Delete from database
  await prisma.story.delete({ where: { id: storyId } });
}

// Get my active stories
export async function getMyStories(userId: string): Promise<StoryResponse[]> {
  const now = new Date();

  const stories = await prisma.story.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return stories.map((story) => ({
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    viewCount: story.viewCount,
    author: story.user,
    isViewed: false,
    expiresAt: story.expiresAt,
    createdAt: story.createdAt,
  }));
}

// Get user's active stories
export async function getUserStories(
  targetUserId: string,
  currentUserId?: string
): Promise<StoryResponse[]> {
  const now = new Date();

  // Check if blocked
  if (currentUserId) {
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: targetUserId, blockedId: currentUserId },
          { blockerId: currentUserId, blockedId: targetUserId },
        ],
      },
    });

    if (block) {
      throw new AppError(403, 'USER_BLOCKED', 'Cannot view stories from this user');
    }
  }

  const stories = await prisma.story.findMany({
    where: {
      userId: targetUserId,
      expiresAt: { gt: now },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      views: currentUserId
        ? {
            where: { userId: currentUserId },
            take: 1,
          }
        : false,
    },
    orderBy: { createdAt: 'asc' }, // Oldest first for viewing order
  });

  return stories.map((story) => ({
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    viewCount: story.viewCount,
    author: story.user,
    isViewed: Array.isArray(story.views) && story.views.length > 0,
    expiresAt: story.expiresAt,
    createdAt: story.createdAt,
  }));
}

// Get feed stories (from followed users)
export async function getFeedStories(userId: string): Promise<UserStoriesGroup[]> {
  const now = new Date();

  // Get users I follow
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });

  const followingIds = following.map((f) => f.followingId);

  // Include own stories
  followingIds.push(userId);

  // Get all active stories from followed users
  const stories = await prisma.story.findMany({
    where: {
      userId: { in: followingIds },
      expiresAt: { gt: now },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      views: {
        where: { userId },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group stories by user
  const userStoriesMap = new Map<string, UserStoriesGroup>();

  for (const story of stories) {
    const authorId = story.user.id;
    const isViewed = story.views.length > 0;

    if (!userStoriesMap.has(authorId)) {
      userStoriesMap.set(authorId, {
        user: story.user,
        stories: [],
        hasUnviewed: false,
      });
    }

    const group = userStoriesMap.get(authorId)!;
    group.stories.push({
      id: story.id,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      viewCount: story.viewCount,
      isViewed,
      expiresAt: story.expiresAt,
      createdAt: story.createdAt,
    });

    if (!isViewed && authorId !== userId) {
      group.hasUnviewed = true;
    }
  }

  // Convert to array and sort (unviewed first, then by most recent story)
  const result = Array.from(userStoriesMap.values());
  result.sort((a, b) => {
    // Own stories first
    if (a.user.id === userId) return -1;
    if (b.user.id === userId) return 1;
    // Then unviewed
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (!a.hasUnviewed && b.hasUnviewed) return 1;
    // Then by most recent
    const aLatest = a.stories[0]?.createdAt || new Date(0);
    const bLatest = b.stories[0]?.createdAt || new Date(0);
    return bLatest.getTime() - aLatest.getTime();
  });

  // Sort stories within each group (oldest first for viewing)
  for (const group of result) {
    group.stories.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  return result;
}

// Cleanup expired stories (can be called by cron job)
export async function cleanupExpiredStories(): Promise<number> {
  const now = new Date();

  // Get expired stories to delete their media
  const expiredStories = await prisma.story.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, mediaUrl: true },
  });

  if (expiredStories.length === 0) {
    return 0;
  }

  // Delete media files from R2
  const keys = expiredStories
    .map((s) => extractKeyFromUrl(s.mediaUrl))
    .filter((k): k is string => k !== null);

  if (keys.length > 0) {
    await deleteFiles(keys);
  }

  // Delete from database
  const result = await prisma.story.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  return result.count;
}
