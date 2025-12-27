import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MediaService } from '@modules/media/media.service.js';
import { Story, StoryMediaType } from './entities/story.entity.js';
import { StoryView } from './entities/story-view.entity.js';
import { UserFollow } from '@database/entities/user-follow.entity.js';
import { UserBlock } from '@database/entities/user-block.entity.js';
import { UserProfile } from '@database/entities/user-profile.entity.js';
import { CreateStoryDto } from './dto/create-story.dto.js';

export interface StoryUserGroup {
  userId: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  hasUnviewed: boolean;
  latestStoryAt: Date;
  stories: Array<{
    id: string;
    mediaUrl: string;
    thumbnailUrl?: string;
    mediaType: StoryMediaType;
    caption?: string;
    viewsCount: number;
    createdAt: Date;
    hasViewed: boolean;
  }>;
}

export interface StoriesFeedResponse {
  users: StoryUserGroup[];
}

export interface ViewerInfo {
  userId: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  viewedAt: Date;
}

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);
  private readonly STORY_DURATION_HOURS = 24;

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryView)
    private readonly viewRepository: Repository<StoryView>,
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
    @InjectRepository(UserBlock)
    private readonly blockRepository: Repository<UserBlock>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    private readonly mediaService: MediaService,
  ) {}

  async create(
    userId: string,
    dto: CreateStoryDto,
    file?: Express.Multer.File,
  ): Promise<Story> {
    let mediaUrl = dto.mediaUrl;
    let thumbnailUrl: string | undefined;
    let mediaType = dto.mediaType || StoryMediaType.IMAGE;

    // Handle file upload
    if (file) {
      const result = await this.mediaService.uploadImage(file, 'posts', userId);
      mediaUrl = result.url;
      thumbnailUrl = result.thumbnailUrl;

      // Detect media type from mimetype
      if (file.mimetype.startsWith('video/')) {
        mediaType = StoryMediaType.VIDEO;
      }
    }

    if (!mediaUrl) {
      throw new BadRequestException('Media file or URL is required');
    }

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.STORY_DURATION_HOURS);

    const story = this.storyRepository.create({
      userId,
      mediaUrl,
      thumbnailUrl,
      mediaType,
      caption: dto.caption,
      expiresAt,
    });

    return this.storyRepository.save(story);
  }

  async findOne(id: string, currentUserId?: string): Promise<Story> {
    const now = new Date();

    const story = await this.storyRepository.findOne({
      where: {
        id,
        expiresAt: MoreThan(now),
      },
      relations: ['user'],
    });

    if (!story) {
      throw new NotFoundException('Story not found or expired');
    }

    // Check if blocked
    if (currentUserId) {
      const blocked = await this.isBlocked(story.userId, currentUserId);
      if (blocked) {
        throw new NotFoundException('Story not found');
      }

      // Check if viewed
      const viewed = await this.viewRepository.findOne({
        where: { storyId: id, userId: currentUserId },
      });
      story.hasViewed = !!viewed;
    }

    return story;
  }

  async findUserStories(
    userId: string,
    currentUserId?: string,
  ): Promise<Story[]> {
    const now = new Date();

    // Check if blocked
    if (currentUserId) {
      const blocked = await this.isBlocked(userId, currentUserId);
      if (blocked) {
        return [];
      }
    }

    const stories = await this.storyRepository.find({
      where: {
        userId,
        expiresAt: MoreThan(now),
      },
      order: { createdAt: 'ASC' },
    });

    // Mark viewed stories
    if (currentUserId && stories.length > 0) {
      const storyIds = stories.map((s) => s.id);
      const views = await this.viewRepository.find({
        where: {
          storyId: In(storyIds),
          userId: currentUserId,
        },
      });
      const viewedIds = new Set(views.map((v) => v.storyId));
      stories.forEach((s) => (s.hasViewed = viewedIds.has(s.id)));
    }

    return stories;
  }

  async getFeedStories(currentUserId: string): Promise<StoriesFeedResponse> {
    const now = new Date();

    // Get blocked users
    const blockedUsers = await this.getBlockedUserIds(currentUserId);

    // Get following users
    const following = await this.followRepository.find({
      where: { followerId: currentUserId },
      select: ['followingId'],
    });
    const followingIds = following.map((f) => f.followingId);

    // Include current user's stories
    followingIds.push(currentUserId);

    if (followingIds.length === 0) {
      return { users: [] };
    }

    // Get all active stories from followed users
    const queryBuilder = this.storyRepository
      .createQueryBuilder('story')
      .where('story.user_id IN (:...userIds)', { userIds: followingIds })
      .andWhere('story.expires_at > :now', { now });

    if (blockedUsers.length > 0) {
      queryBuilder.andWhere('story.user_id NOT IN (:...blockedUsers)', {
        blockedUsers,
      });
    }

    queryBuilder.orderBy('story.created_at', 'DESC');

    const stories = await queryBuilder.getMany();

    if (stories.length === 0) {
      return { users: [] };
    }

    // Get story IDs and check which are viewed
    const storyIds = stories.map((s) => s.id);
    const views = await this.viewRepository.find({
      where: {
        storyId: In(storyIds),
        userId: currentUserId,
      },
    });
    const viewedIds = new Set(views.map((v) => v.storyId));

    // Get user profiles
    const userIds = [...new Set(stories.map((s) => s.userId))];
    const profiles = await this.profileRepository.find({
      where: { userId: In(userIds) },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    // Group stories by user
    const userStoriesMap = new Map<string, StoryUserGroup>();

    for (const story of stories) {
      const profile = profileMap.get(story.userId);
      const hasViewed = viewedIds.has(story.id);

      if (!userStoriesMap.has(story.userId)) {
        userStoriesMap.set(story.userId, {
          userId: story.userId,
          username: profile?.username || '',
          fullName: profile?.fullName,
          avatarUrl: profile?.avatarUrl,
          hasUnviewed: !hasViewed,
          latestStoryAt: story.createdAt,
          stories: [],
        });
      }

      const userGroup = userStoriesMap.get(story.userId)!;

      // Update hasUnviewed if any story is unviewed
      if (!hasViewed) {
        userGroup.hasUnviewed = true;
      }

      // Update latest story time
      if (story.createdAt > userGroup.latestStoryAt) {
        userGroup.latestStoryAt = story.createdAt;
      }

      userGroup.stories.push({
        id: story.id,
        mediaUrl: story.mediaUrl,
        thumbnailUrl: story.thumbnailUrl,
        mediaType: story.mediaType,
        caption: story.caption,
        viewsCount: story.viewsCount,
        createdAt: story.createdAt,
        hasViewed,
      });
    }

    // Convert to array and sort
    const users = Array.from(userStoriesMap.values());

    // Sort: current user first, then users with unviewed stories, then by latest story
    users.sort((a, b) => {
      // Current user first
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;

      // Unviewed stories first
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;

      // Then by latest story
      return b.latestStoryAt.getTime() - a.latestStoryAt.getTime();
    });

    // Sort stories within each user by createdAt ASC
    users.forEach((user) => {
      user.stories.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
    });

    return { users };
  }

  async markAsViewed(
    storyId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const story = await this.findOne(storyId, userId);

    // Don't count self-views
    if (story.userId === userId) {
      return { success: true };
    }

    // Check if already viewed
    const existing = await this.viewRepository.findOne({
      where: { storyId, userId },
    });

    if (existing) {
      return { success: true };
    }

    // Create view record
    const view = this.viewRepository.create({ storyId, userId });
    await this.viewRepository.save(view);

    // Increment view count
    await this.storyRepository.increment({ id: storyId }, 'viewsCount', 1);

    return { success: true };
  }

  async getViewers(
    storyId: string,
    userId: string,
  ): Promise<ViewerInfo[]> {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    // Only owner can see viewers
    if (story.userId !== userId) {
      throw new ForbiddenException('Only story owner can view viewers');
    }

    const views = await this.viewRepository.find({
      where: { storyId },
      order: { viewedAt: 'DESC' },
    });

    if (views.length === 0) {
      return [];
    }

    // Get profiles
    const viewerIds = views.map((v) => v.userId);
    const profiles = await this.profileRepository.find({
      where: { userId: In(viewerIds) },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    return views.map((view) => {
      const profile = profileMap.get(view.userId);
      return {
        userId: view.userId,
        username: profile?.username || '',
        fullName: profile?.fullName,
        avatarUrl: profile?.avatarUrl,
        viewedAt: view.viewedAt,
      };
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const story = await this.storyRepository.findOne({
      where: { id },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('You can only delete your own stories');
    }

    // Delete media from R2
    try {
      await this.mediaService.deleteImage(story.mediaUrl);
    } catch (error) {
      this.logger.warn(`Failed to delete story media: ${story.mediaUrl}`, error);
    }

    await this.storyRepository.delete(id);
  }

  // Scheduled job - runs every hour
  @Cron(CronExpression.EVERY_HOUR)
  async deleteExpired(): Promise<void> {
    const now = new Date();

    // Find expired stories
    const expiredStories = await this.storyRepository.find({
      where: {
        expiresAt: LessThan(now),
      },
    });

    if (expiredStories.length === 0) {
      return;
    }

    this.logger.log(`Cleaning up ${expiredStories.length} expired stories`);

    // Delete media from R2
    for (const story of expiredStories) {
      try {
        await this.mediaService.deleteImage(story.mediaUrl);
      } catch (error) {
        this.logger.warn(
          `Failed to delete expired story media: ${story.mediaUrl}`,
          error,
        );
      }
    }

    // Delete stories (views will cascade)
    const storyIds = expiredStories.map((s) => s.id);
    await this.storyRepository.delete({ id: In(storyIds) });

    this.logger.log(`Deleted ${expiredStories.length} expired stories`);
  }

  // Helper methods

  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.blockRepository.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });

    const blockedIds = new Set<string>();
    blocks.forEach((b) => {
      if (b.blockerId === userId) blockedIds.add(b.blockedId);
      else blockedIds.add(b.blockerId);
    });

    return Array.from(blockedIds);
  }

  private async isBlocked(
    userId1: string,
    userId2: string,
  ): Promise<boolean> {
    const block = await this.blockRepository.findOne({
      where: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    });

    return !!block;
  }
}
