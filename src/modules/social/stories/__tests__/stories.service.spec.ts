import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { StoriesService } from '../stories.service.js';
import { Story, StoryMediaType } from '../entities/story.entity.js';
import { StoryView } from '../entities/story-view.entity.js';
import { CreateStoryDto } from '../dto/create-story.dto.js';

describe('StoriesService', () => {
  let service: StoriesService;
  let mockStoryRepo: Record<string, Mock>;
  let mockViewRepo: Record<string, Mock>;
  let mockFollowRepo: Record<string, Mock>;
  let mockBlockRepo: Record<string, Mock>;
  let mockProfileRepo: Record<string, Mock>;
  let mockMediaService: Record<string, Mock>;
  let mockQueryBuilder: Record<string, Mock>;

  const mockUser = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
  };

  const mockProfile = {
    userId: 'user-uuid-1234',
    username: 'testuser',
    fullName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
  };

  const mockStory: Partial<Story> = {
    id: 'story-uuid-1234',
    userId: 'user-uuid-1234',
    mediaUrl: 'https://r2.example.com/stories/media.jpg',
    thumbnailUrl: 'https://r2.example.com/stories/thumb.jpg',
    mediaType: StoryMediaType.IMAGE,
    caption: 'Test story caption',
    viewsCount: 10,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    createdAt: new Date(),
  };

  const mockStoryView: Partial<StoryView> = {
    id: 'view-uuid-1234',
    storyId: 'story-uuid-1234',
    userId: 'viewer-uuid-1234',
    viewedAt: new Date(),
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'story.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test'),
    size: 1024,
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockQueryBuilder = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };

    mockStoryRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      delete: vi.fn(),
      increment: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockViewRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      delete: vi.fn(),
    };

    mockFollowRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockBlockRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
    };

    mockProfileRepo = {
      find: vi.fn().mockResolvedValue([mockProfile]),
    };

    mockMediaService = {
      uploadImage: vi.fn().mockResolvedValue({
        url: 'https://r2.example.com/stories/uploaded.jpg',
        thumbnailUrl: 'https://r2.example.com/stories/uploaded-thumb.jpg',
      }),
      deleteImage: vi.fn().mockResolvedValue(undefined),
    };

    service = new StoriesService(
      mockStoryRepo as any,
      mockViewRepo as any,
      mockFollowRepo as any,
      mockBlockRepo as any,
      mockProfileRepo as any,
      mockMediaService as any,
    );
  });

  describe('create', () => {
    it('should create story with uploaded file', async () => {
      const dto: CreateStoryDto = {
        caption: 'My new story',
      };

      mockStoryRepo.create.mockReturnValue({
        ...mockStory,
        mediaUrl: 'https://r2.example.com/stories/uploaded.jpg',
      });
      mockStoryRepo.save.mockResolvedValue({
        ...mockStory,
        mediaUrl: 'https://r2.example.com/stories/uploaded.jpg',
      });

      const result = await service.create('user-uuid-1234', dto, mockFile);

      expect(mockMediaService.uploadImage).toHaveBeenCalledWith(
        mockFile,
        'posts',
        'user-uuid-1234',
      );
      expect(mockStoryRepo.create).toHaveBeenCalled();
      expect(mockStoryRepo.save).toHaveBeenCalled();
      expect(result.mediaUrl).toBe(
        'https://r2.example.com/stories/uploaded.jpg',
      );
    });

    it('should create story with pre-uploaded media URL', async () => {
      const dto: CreateStoryDto = {
        caption: 'Story with URL',
        mediaUrl: 'https://example.com/media.jpg',
        mediaType: StoryMediaType.IMAGE,
      };

      mockStoryRepo.create.mockReturnValue(mockStory);
      mockStoryRepo.save.mockResolvedValue(mockStory);

      const result = await service.create('user-uuid-1234', dto);

      expect(mockMediaService.uploadImage).not.toHaveBeenCalled();
      expect(mockStoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaUrl: 'https://example.com/media.jpg',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should create story with video file', async () => {
      const videoFile: Express.Multer.File = {
        ...mockFile,
        mimetype: 'video/mp4',
        originalname: 'story.mp4',
      };

      const dto: CreateStoryDto = {
        caption: 'Video story',
      };

      mockStoryRepo.create.mockReturnValue({
        ...mockStory,
        mediaType: StoryMediaType.VIDEO,
      });
      mockStoryRepo.save.mockResolvedValue({
        ...mockStory,
        mediaType: StoryMediaType.VIDEO,
      });

      await service.create('user-uuid-1234', dto, videoFile);

      expect(mockStoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: StoryMediaType.VIDEO,
        }),
      );
    });

    it('should throw BadRequestException if no media provided', async () => {
      const dto: CreateStoryDto = {
        caption: 'Story without media',
      };

      await expect(service.create('user-uuid-1234', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should set expiresAt to 24 hours from now', async () => {
      const dto: CreateStoryDto = {
        mediaUrl: 'https://example.com/media.jpg',
      };

      const now = Date.now();
      vi.setSystemTime(now);

      mockStoryRepo.create.mockImplementation((data) => data);
      mockStoryRepo.save.mockImplementation((story) => Promise.resolve(story));

      await service.create('user-uuid-1234', dto);

      const createCall = mockStoryRepo.create.mock.calls[0][0];
      const expiresAt = new Date(createCall.expiresAt);
      const expectedExpiry = new Date(now + 24 * 60 * 60 * 1000);

      // Allow 1 second tolerance
      expect(
        Math.abs(expiresAt.getTime() - expectedExpiry.getTime()),
      ).toBeLessThan(1000);

      vi.useRealTimers();
    });
  });

  describe('findOne', () => {
    it('should return story if not expired', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);

      const result = await service.findOne('story-uuid-1234');

      expect(result).toBeDefined();
      expect(result.id).toBe('story-uuid-1234');
    });

    it('should throw NotFoundException if story not found or expired', async () => {
      mockStoryRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if user is blocked', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);
      mockBlockRepo.findOne.mockResolvedValue({ id: 'block-id' });

      await expect(
        service.findOne('story-uuid-1234', 'blocked-user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark hasViewed when viewed by current user', async () => {
      mockStoryRepo.findOne.mockResolvedValue({ ...mockStory });
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockViewRepo.findOne.mockResolvedValue(mockStoryView);

      const result = await service.findOne(
        'story-uuid-1234',
        'viewer-uuid-1234',
      );

      expect(result.hasViewed).toBe(true);
    });

    it('should not mark hasViewed when not viewed', async () => {
      mockStoryRepo.findOne.mockResolvedValue({ ...mockStory });
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockViewRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne(
        'story-uuid-1234',
        'viewer-uuid-1234',
      );

      expect(result.hasViewed).toBe(false);
    });
  });

  describe('findUserStories', () => {
    it('should return active stories for user', async () => {
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockStoryRepo.find.mockResolvedValue([mockStory]);
      mockViewRepo.find.mockResolvedValue([]);

      const result = await service.findUserStories(
        'user-uuid-1234',
        'viewer-uuid',
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('story-uuid-1234');
    });

    it('should return empty array if blocked', async () => {
      mockBlockRepo.findOne.mockResolvedValue({ id: 'block-id' });

      const result = await service.findUserStories(
        'user-uuid-1234',
        'blocked-user-id',
      );

      expect(result).toHaveLength(0);
    });

    it('should mark viewed stories correctly', async () => {
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockStoryRepo.find.mockResolvedValue([
        { ...mockStory, id: 'story-1' },
        { ...mockStory, id: 'story-2' },
      ]);
      mockViewRepo.find.mockResolvedValue([{ storyId: 'story-1' }]);

      const result = await service.findUserStories(
        'user-uuid-1234',
        'viewer-uuid',
      );

      expect(result[0].hasViewed).toBe(true);
      expect(result[1].hasViewed).toBe(false);
    });
  });

  describe('getFeedStories', () => {
    it('should return stories from followed users', async () => {
      mockFollowRepo.find.mockResolvedValue([
        { followingId: 'followed-user-1' },
        { followingId: 'followed-user-2' },
      ]);
      mockBlockRepo.find.mockResolvedValue([]);

      const storiesFromFollowed = [
        {
          ...mockStory,
          id: 'story-1',
          userId: 'followed-user-1',
          createdAt: new Date(),
        },
        {
          ...mockStory,
          id: 'story-2',
          userId: 'followed-user-2',
          createdAt: new Date(),
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(storiesFromFollowed);
      mockViewRepo.find.mockResolvedValue([]);
      mockProfileRepo.find.mockResolvedValue([
        { userId: 'followed-user-1', username: 'user1', fullName: 'User One' },
        { userId: 'followed-user-2', username: 'user2', fullName: 'User Two' },
      ]);

      const result = await service.getFeedStories('current-user-id');

      expect(result.users).toHaveLength(2);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'story.user_id IN (:...userIds)',
        expect.objectContaining({ userIds: expect.any(Array) }),
      );
    });

    it('should include current users own stories', async () => {
      mockFollowRepo.find.mockResolvedValue([]);
      mockBlockRepo.find.mockResolvedValue([]);

      const ownStory = {
        ...mockStory,
        userId: 'current-user-id',
        createdAt: new Date(),
      };

      mockQueryBuilder.getMany.mockResolvedValue([ownStory]);
      mockViewRepo.find.mockResolvedValue([]);
      mockProfileRepo.find.mockResolvedValue([
        { userId: 'current-user-id', username: 'me', fullName: 'Current User' },
      ]);

      const result = await service.getFeedStories('current-user-id');

      expect(result.users).toHaveLength(1);
      expect(result.users[0].userId).toBe('current-user-id');
    });

    it('should exclude blocked users from feed', async () => {
      mockFollowRepo.find.mockResolvedValue([
        { followingId: 'blocked-user' },
        { followingId: 'normal-user' },
      ]);
      mockBlockRepo.find.mockResolvedValue([
        { blockerId: 'current-user-id', blockedId: 'blocked-user' },
      ]);

      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.getFeedStories('current-user-id');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'story.user_id NOT IN (:...blockedUsers)',
        { blockedUsers: ['blocked-user'] },
      );
    });

    it('should return empty users array if no following', async () => {
      mockFollowRepo.find.mockResolvedValue([]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getFeedStories('lonely-user-id');

      expect(result.users).toHaveLength(0);
    });

    it('should sort users with unviewed stories first', async () => {
      mockFollowRepo.find.mockResolvedValue([
        { followingId: 'user-1' },
        { followingId: 'user-2' },
      ]);
      mockBlockRepo.find.mockResolvedValue([]);

      const stories = [
        {
          ...mockStory,
          id: 'story-1',
          userId: 'user-1',
          createdAt: new Date(),
        },
        {
          ...mockStory,
          id: 'story-2',
          userId: 'user-2',
          createdAt: new Date(),
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(stories);
      // user-1's story is viewed, user-2's is not
      mockViewRepo.find.mockResolvedValue([{ storyId: 'story-1' }]);
      mockProfileRepo.find.mockResolvedValue([
        { userId: 'user-1', username: 'user1' },
        { userId: 'user-2', username: 'user2' },
      ]);

      const result = await service.getFeedStories('current-user-id');

      // User with unviewed stories should be first
      expect(result.users[0].userId).toBe('user-2');
      expect(result.users[0].hasUnviewed).toBe(true);
      expect(result.users[1].hasUnviewed).toBe(false);
    });

    it('should mark stories with hasViewed correctly', async () => {
      mockFollowRepo.find.mockResolvedValue([{ followingId: 'user-1' }]);
      mockBlockRepo.find.mockResolvedValue([]);

      const stories = [
        {
          ...mockStory,
          id: 'story-1',
          userId: 'user-1',
          createdAt: new Date(),
        },
        {
          ...mockStory,
          id: 'story-2',
          userId: 'user-1',
          createdAt: new Date(),
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(stories);
      mockViewRepo.find.mockResolvedValue([{ storyId: 'story-1' }]);
      mockProfileRepo.find.mockResolvedValue([
        { userId: 'user-1', username: 'user1' },
      ]);

      const result = await service.getFeedStories('current-user-id');

      const userStories = result.users[0].stories;
      expect(userStories.find((s) => s.id === 'story-1')?.hasViewed).toBe(true);
      expect(userStories.find((s) => s.id === 'story-2')?.hasViewed).toBe(
        false,
      );
    });
  });

  describe('markAsViewed', () => {
    it('should create view record and increment count', async () => {
      mockStoryRepo.findOne.mockResolvedValue({
        ...mockStory,
        userId: 'story-owner-id',
      });
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockViewRepo.findOne.mockResolvedValue(null);
      mockViewRepo.create.mockReturnValue(mockStoryView);
      mockViewRepo.save.mockResolvedValue(mockStoryView);

      const result = await service.markAsViewed('story-uuid-1234', 'viewer-id');

      expect(result.success).toBe(true);
      expect(mockViewRepo.save).toHaveBeenCalled();
      expect(mockStoryRepo.increment).toHaveBeenCalledWith(
        { id: 'story-uuid-1234' },
        'viewsCount',
        1,
      );
    });

    it('should not count self-views', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);
      mockBlockRepo.findOne.mockResolvedValue(null);

      const result = await service.markAsViewed(
        'story-uuid-1234',
        'user-uuid-1234',
      );

      expect(result.success).toBe(true);
      expect(mockViewRepo.save).not.toHaveBeenCalled();
      expect(mockStoryRepo.increment).not.toHaveBeenCalled();
    });

    it('should not create duplicate view record', async () => {
      mockStoryRepo.findOne.mockResolvedValue({
        ...mockStory,
        userId: 'story-owner-id',
      });
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockViewRepo.findOne.mockImplementation((options: any) => {
        if (options?.where?.storyId && options?.where?.userId === 'viewer-id') {
          return Promise.resolve(mockStoryView);
        }
        return Promise.resolve(null);
      });

      const result = await service.markAsViewed('story-uuid-1234', 'viewer-id');

      expect(result.success).toBe(true);
      expect(mockViewRepo.save).not.toHaveBeenCalled();
      expect(mockStoryRepo.increment).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for expired story', async () => {
      mockStoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markAsViewed('expired-story-id', 'viewer-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getViewers', () => {
    it('should return list of viewers for story owner', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);
      mockViewRepo.find.mockResolvedValue([
        { userId: 'viewer-1', viewedAt: new Date() },
        { userId: 'viewer-2', viewedAt: new Date() },
      ]);
      mockProfileRepo.find.mockResolvedValue([
        { userId: 'viewer-1', username: 'viewer1', fullName: 'Viewer One' },
        { userId: 'viewer-2', username: 'viewer2', fullName: 'Viewer Two' },
      ]);

      const result = await service.getViewers(
        'story-uuid-1234',
        'user-uuid-1234',
      );

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('viewer1');
      expect(result[1].username).toBe('viewer2');
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);

      await expect(
        service.getViewers('story-uuid-1234', 'other-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if story not found', async () => {
      mockStoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getViewers('non-existent-id', 'user-uuid-1234'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty array if no viewers', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);
      mockViewRepo.find.mockResolvedValue([]);

      const result = await service.getViewers(
        'story-uuid-1234',
        'user-uuid-1234',
      );

      expect(result).toHaveLength(0);
    });

    it('should include viewedAt timestamp for each viewer', async () => {
      const viewedAt = new Date('2024-01-15T10:30:00Z');
      mockStoryRepo.findOne.mockResolvedValue(mockStory);
      mockViewRepo.find.mockResolvedValue([{ userId: 'viewer-1', viewedAt }]);
      mockProfileRepo.find.mockResolvedValue([
        { userId: 'viewer-1', username: 'viewer1' },
      ]);

      const result = await service.getViewers(
        'story-uuid-1234',
        'user-uuid-1234',
      );

      expect(result[0].viewedAt).toEqual(viewedAt);
    });
  });

  describe('delete', () => {
    it('should delete story and remove media from R2', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);
      mockStoryRepo.delete.mockResolvedValue({ affected: 1 });

      await service.delete('story-uuid-1234', 'user-uuid-1234');

      expect(mockMediaService.deleteImage).toHaveBeenCalledWith(
        mockStory.mediaUrl,
      );
      expect(mockStoryRepo.delete).toHaveBeenCalledWith('story-uuid-1234');
    });

    it('should throw NotFoundException if story not found', async () => {
      mockStoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.delete('non-existent-id', 'user-uuid-1234'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);

      await expect(
        service.delete('story-uuid-1234', 'other-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should still delete story even if R2 deletion fails', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);
      mockMediaService.deleteImage.mockRejectedValue(new Error('R2 error'));
      mockStoryRepo.delete.mockResolvedValue({ affected: 1 });

      await service.delete('story-uuid-1234', 'user-uuid-1234');

      expect(mockStoryRepo.delete).toHaveBeenCalledWith('story-uuid-1234');
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired stories and their media', async () => {
      const expiredStories = [
        {
          ...mockStory,
          id: 'expired-1',
          mediaUrl: 'https://r2.example.com/1.jpg',
        },
        {
          ...mockStory,
          id: 'expired-2',
          mediaUrl: 'https://r2.example.com/2.jpg',
        },
      ];

      mockStoryRepo.find.mockResolvedValue(expiredStories);
      mockStoryRepo.delete.mockResolvedValue({ affected: 2 });

      await service.deleteExpired();

      expect(mockMediaService.deleteImage).toHaveBeenCalledTimes(2);
      expect(mockMediaService.deleteImage).toHaveBeenCalledWith(
        'https://r2.example.com/1.jpg',
      );
      expect(mockMediaService.deleteImage).toHaveBeenCalledWith(
        'https://r2.example.com/2.jpg',
      );
      expect(mockStoryRepo.delete).toHaveBeenCalled();
    });

    it('should do nothing if no expired stories', async () => {
      mockStoryRepo.find.mockResolvedValue([]);

      await service.deleteExpired();

      expect(mockMediaService.deleteImage).not.toHaveBeenCalled();
      expect(mockStoryRepo.delete).not.toHaveBeenCalled();
    });

    it('should continue deleting even if some R2 deletions fail', async () => {
      const expiredStories = [
        {
          ...mockStory,
          id: 'expired-1',
          mediaUrl: 'https://r2.example.com/1.jpg',
        },
        {
          ...mockStory,
          id: 'expired-2',
          mediaUrl: 'https://r2.example.com/2.jpg',
        },
      ];

      mockStoryRepo.find.mockResolvedValue(expiredStories);
      mockMediaService.deleteImage
        .mockRejectedValueOnce(new Error('R2 error'))
        .mockResolvedValueOnce(undefined);
      mockStoryRepo.delete.mockResolvedValue({ affected: 2 });

      await service.deleteExpired();

      expect(mockMediaService.deleteImage).toHaveBeenCalledTimes(2);
      expect(mockStoryRepo.delete).toHaveBeenCalled();
    });

    it('should query for stories with expiresAt less than now', async () => {
      mockStoryRepo.find.mockResolvedValue([]);

      await service.deleteExpired();

      expect(mockStoryRepo.find).toHaveBeenCalledWith({
        where: {
          expiresAt: expect.any(Object),
        },
      });
    });
  });

  describe('story expiration', () => {
    it('should not return expired story in findOne', async () => {
      // Story with expiresAt in the past
      const expiredStory = {
        ...mockStory,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      };

      mockStoryRepo.findOne.mockResolvedValue(null); // TypeORM query filters by expiresAt > now

      await expect(service.findOne('expired-story-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should query with MoreThan(now) for expiry check', async () => {
      mockStoryRepo.findOne.mockResolvedValue(mockStory);

      await service.findOne('story-uuid-1234');

      expect(mockStoryRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'story-uuid-1234',
            expiresAt: expect.any(Object),
          }),
        }),
      );
    });
  });
});
