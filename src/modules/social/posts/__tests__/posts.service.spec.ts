import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostsService } from '../posts.service.js';
import { Post, PostVisibility } from '../entities/post.entity.js';
import { PostImage } from '../entities/post-image.entity.js';
import { PostLike } from '../entities/post-like.entity.js';
import { Hashtag } from '../entities/hashtag.entity.js';
import { PostHashtag } from '../entities/post-hashtag.entity.js';
import { PostMention } from '../entities/post-mention.entity.js';

describe('PostsService', () => {
  let service: PostsService;
  let mockPostRepo: Record<string, Mock>;
  let mockImageRepo: Record<string, Mock>;
  let mockLikeRepo: Record<string, Mock>;
  let mockHashtagRepo: Record<string, Mock>;
  let mockPostHashtagRepo: Record<string, Mock>;
  let mockMentionRepo: Record<string, Mock>;
  let mockFollowRepo: Record<string, Mock>;
  let mockBlockRepo: Record<string, Mock>;
  let mockProfileRepo: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;
  let mockMediaService: Record<string, Mock>;

  const mockUser = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
    profile: {
      username: 'testuser',
      fullName: 'Test User',
    },
  };

  const mockPost: Partial<Post> = {
    id: 'post-uuid-1234',
    userId: 'user-uuid-1234',
    content: 'Test post #trending @mention',
    visibility: PostVisibility.PUBLIC,
    likesCount: 10,
    commentsCount: 5,
    sharesCount: 2,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser as any,
    images: [],
  };

  const mockImage: Partial<PostImage> = {
    id: 'image-uuid-1234',
    postId: 'post-uuid-1234',
    url: 'https://r2.example.com/posts/image1.jpg',
    thumbnailUrl: 'https://r2.example.com/posts/image1_thumb.jpg',
    sortOrder: 0,
  };

  const mockHashtag: Partial<Hashtag> = {
    id: 'hashtag-uuid-1234',
    name: 'trending',
    postsCount: 100,
  };

  const mockLike: Partial<PostLike> = {
    id: 'like-uuid-1234',
    postId: 'post-uuid-1234',
    userId: 'user-uuid-1234',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPostRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      increment: vi.fn(),
      decrement: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    mockImageRepo = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    };

    mockLikeRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockHashtagRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      increment: vi.fn(),
      decrement: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    mockPostHashtagRepo = {
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockMentionRepo = {
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockFollowRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
    };

    mockBlockRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
    };

    mockProfileRepo = {
      findOne: vi.fn(),
    };

    mockRedisService = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
    };

    mockMediaService = {
      uploadImages: vi.fn(),
      deleteImage: vi.fn(),
    };

    service = new PostsService(
      mockPostRepo as any,
      mockImageRepo as any,
      mockLikeRepo as any,
      mockHashtagRepo as any,
      mockPostHashtagRepo as any,
      mockMentionRepo as any,
      mockFollowRepo as any,
      mockBlockRepo as any,
      mockProfileRepo as any,
      mockRedisService as any,
      mockMediaService as any,
    );
  });

  describe('create', () => {
    const createDto = {
      content: 'Hello world! #testing @user',
      visibility: PostVisibility.PUBLIC,
    };

    it('should create a post successfully', async () => {
      mockPostRepo.create.mockReturnValue(mockPost);
      mockPostRepo.save.mockResolvedValue(mockPost);
      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockHashtagRepo.findOne.mockResolvedValue(null);
      mockHashtagRepo.create.mockReturnValue(mockHashtag);
      mockHashtagRepo.save.mockResolvedValue(mockHashtag);
      mockPostHashtagRepo.create.mockReturnValue({});
      mockPostHashtagRepo.save.mockResolvedValue({});
      mockHashtagRepo.increment.mockResolvedValue({});
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.find.mockResolvedValue([]);
      mockLikeRepo.findOne.mockResolvedValue(null);

      const result = await service.create('user-uuid-1234', createDto);

      expect(result).toBeDefined();
      expect(mockPostRepo.create).toHaveBeenCalledWith({
        userId: 'user-uuid-1234',
        content: createDto.content,
        visibility: createDto.visibility,
        originalPostId: undefined,
      });
      expect(mockPostRepo.save).toHaveBeenCalled();
    });

    it('should create a post with image URLs', async () => {
      const dtoWithImages = {
        ...createDto,
        imageUrls: ['https://r2.example.com/image1.jpg'],
      };

      mockPostRepo.create.mockReturnValue(mockPost);
      mockPostRepo.save.mockResolvedValue(mockPost);
      mockPostRepo.findOne.mockResolvedValue({
        ...mockPost,
        images: [mockImage],
      });
      mockImageRepo.count.mockResolvedValue(0);
      mockImageRepo.create.mockReturnValue(mockImage);
      mockImageRepo.save.mockResolvedValue([mockImage]);
      mockHashtagRepo.findOne.mockResolvedValue(null);
      mockHashtagRepo.create.mockReturnValue(mockHashtag);
      mockHashtagRepo.save.mockResolvedValue(mockHashtag);
      mockPostHashtagRepo.create.mockReturnValue({});
      mockPostHashtagRepo.save.mockResolvedValue({});
      mockHashtagRepo.increment.mockResolvedValue({});
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.find.mockResolvedValue([]);
      mockLikeRepo.findOne.mockResolvedValue(null);

      const result = await service.create('user-uuid-1234', dtoWithImages);

      expect(result).toBeDefined();
      expect(mockImageRepo.save).toHaveBeenCalled();
    });

    it('should create a post with uploaded files', async () => {
      const files = [
        {
          buffer: Buffer.from('test'),
          mimetype: 'image/jpeg',
          originalname: 'test.jpg',
        },
      ] as Express.Multer.File[];

      mockPostRepo.create.mockReturnValue(mockPost);
      mockPostRepo.save.mockResolvedValue(mockPost);
      mockPostRepo.findOne.mockResolvedValue({
        ...mockPost,
        images: [mockImage],
      });
      mockMediaService.uploadImages.mockResolvedValue([
        {
          url: 'https://r2.example.com/uploaded.jpg',
          thumbnailUrl: 'https://r2.example.com/uploaded_thumb.jpg',
          width: 800,
          height: 600,
        },
      ]);
      mockImageRepo.create.mockReturnValue(mockImage);
      mockImageRepo.save.mockResolvedValue([mockImage]);
      mockHashtagRepo.findOne.mockResolvedValue(null);
      mockHashtagRepo.create.mockReturnValue(mockHashtag);
      mockHashtagRepo.save.mockResolvedValue(mockHashtag);
      mockPostHashtagRepo.create.mockReturnValue({});
      mockPostHashtagRepo.save.mockResolvedValue({});
      mockHashtagRepo.increment.mockResolvedValue({});
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.find.mockResolvedValue([]);
      mockLikeRepo.findOne.mockResolvedValue(null);

      const result = await service.create('user-uuid-1234', createDto, files);

      expect(result).toBeDefined();
      expect(mockMediaService.uploadImages).toHaveBeenCalledWith(
        files,
        'posts',
        'user-uuid-1234',
      );
    });

    it('should create and link hashtags from content', async () => {
      const dtoWithHashtags = {
        content: 'Test #first #second #third',
        visibility: PostVisibility.PUBLIC,
      };

      mockPostRepo.create.mockReturnValue(mockPost);
      mockPostRepo.save.mockResolvedValue(mockPost);
      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockHashtagRepo.findOne.mockResolvedValue(null);
      mockHashtagRepo.create.mockReturnValue(mockHashtag);
      mockHashtagRepo.save.mockResolvedValue(mockHashtag);
      mockPostHashtagRepo.create.mockReturnValue({});
      mockPostHashtagRepo.save.mockResolvedValue({});
      mockHashtagRepo.increment.mockResolvedValue({});
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.find.mockResolvedValue([]);
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.create('user-uuid-1234', dtoWithHashtags);

      // Should create 3 hashtags
      expect(mockHashtagRepo.findOne).toHaveBeenCalledTimes(3);
      expect(mockPostHashtagRepo.save).toHaveBeenCalledTimes(3);
      expect(mockHashtagRepo.increment).toHaveBeenCalledTimes(3);
    });

    it('should use existing hashtags if they already exist', async () => {
      const dtoWithHashtags = {
        content: 'Test #existing',
        visibility: PostVisibility.PUBLIC,
      };

      mockPostRepo.create.mockReturnValue(mockPost);
      mockPostRepo.save.mockResolvedValue(mockPost);
      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockHashtagRepo.findOne.mockResolvedValue(mockHashtag); // Hashtag exists
      mockPostHashtagRepo.create.mockReturnValue({});
      mockPostHashtagRepo.save.mockResolvedValue({});
      mockHashtagRepo.increment.mockResolvedValue({});
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.find.mockResolvedValue([]);
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.create('user-uuid-1234', dtoWithHashtags);

      // Should NOT create new hashtag
      expect(mockHashtagRepo.create).not.toHaveBeenCalled();
      expect(mockHashtagRepo.save).not.toHaveBeenCalled();
      // But should link it
      expect(mockPostHashtagRepo.save).toHaveBeenCalled();
      expect(mockHashtagRepo.increment).toHaveBeenCalled();
    });

    it('should create repost and increment share count', async () => {
      const repostDto = {
        content: 'Reposting this!',
        visibility: PostVisibility.PUBLIC,
        originalPostId: 'original-post-uuid',
      };

      mockPostRepo.create.mockReturnValue({
        ...mockPost,
        originalPostId: 'original-post-uuid',
      });
      mockPostRepo.save.mockResolvedValue({
        ...mockPost,
        originalPostId: 'original-post-uuid',
      });
      mockPostRepo.findOne.mockResolvedValue({
        ...mockPost,
        originalPostId: 'original-post-uuid',
      });
      mockPostRepo.increment.mockResolvedValue({});
      mockHashtagRepo.findOne.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.find.mockResolvedValue([]);
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.create('user-uuid-1234', repostDto);

      expect(mockPostRepo.increment).toHaveBeenCalledWith(
        { id: 'original-post-uuid' },
        'sharesCount',
        1,
      );
    });
  });

  describe('findOne', () => {
    it('should return a post by ID', async () => {
      mockPostRepo.findOne.mockResolvedValue(mockPost);

      const result = await service.findOne('post-uuid-1234');

      expect(result).toBeDefined();
      expect(result.id).toBe('post-uuid-1234');
    });

    it('should throw NotFoundException for non-existent post', async () => {
      mockPostRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for private post accessed by non-owner', async () => {
      const privatePost = { ...mockPost, visibility: PostVisibility.PRIVATE };
      mockPostRepo.findOne.mockResolvedValue(privatePost);

      await expect(
        service.findOne('post-uuid-1234', 'other-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for followers-only post accessed by non-follower', async () => {
      const followersPost = {
        ...mockPost,
        visibility: PostVisibility.FOLLOWERS,
      };
      mockPostRepo.findOne.mockResolvedValue(followersPost);
      mockFollowRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('post-uuid-1234', 'other-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to see private post', async () => {
      const privatePost = { ...mockPost, visibility: PostVisibility.PRIVATE };
      mockPostRepo.findOne.mockResolvedValue(privatePost);
      mockLikeRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('post-uuid-1234', 'user-uuid-1234');

      expect(result).toBeDefined();
    });

    it('should check like status for authenticated user', async () => {
      mockPostRepo.findOne.mockResolvedValue({ ...mockPost });
      mockLikeRepo.findOne.mockResolvedValue(mockLike);

      const result = await service.findOne('post-uuid-1234', 'user-uuid-1234');

      expect(result.isLiked).toBe(true);
    });
  });

  describe('update', () => {
    const updateDto = {
      content: 'Updated content #newtag',
    };

    it('should update a post successfully', async () => {
      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockPostRepo.update.mockResolvedValue({ affected: 1 });
      mockPostHashtagRepo.find.mockResolvedValue([]);
      mockPostHashtagRepo.delete.mockResolvedValue({});
      mockHashtagRepo.findOne.mockResolvedValue(null);
      mockHashtagRepo.create.mockReturnValue(mockHashtag);
      mockHashtagRepo.save.mockResolvedValue(mockHashtag);
      mockPostHashtagRepo.create.mockReturnValue({});
      mockPostHashtagRepo.save.mockResolvedValue({});
      mockHashtagRepo.increment.mockResolvedValue({});
      mockMentionRepo.delete.mockResolvedValue({});
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.findOne.mockResolvedValue(null);

      const result = await service.update(
        'post-uuid-1234',
        'user-uuid-1234',
        updateDto,
      );

      expect(result).toBeDefined();
      expect(mockPostRepo.update).toHaveBeenCalledWith('post-uuid-1234', {
        content: updateDto.content,
        visibility: undefined,
        isEdited: true,
      });
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPostRepo.findOne.mockResolvedValue(mockPost);

      await expect(
        service.update('post-uuid-1234', 'different-user-id', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reprocess hashtags on content update', async () => {
      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockPostRepo.update.mockResolvedValue({ affected: 1 });
      mockPostHashtagRepo.find.mockResolvedValue([
        { hashtagId: 'old-hashtag-id' },
      ]);
      mockHashtagRepo.decrement.mockResolvedValue({});
      mockPostHashtagRepo.delete.mockResolvedValue({});
      mockHashtagRepo.findOne.mockResolvedValue(null);
      mockHashtagRepo.create.mockReturnValue(mockHashtag);
      mockHashtagRepo.save.mockResolvedValue(mockHashtag);
      mockPostHashtagRepo.create.mockReturnValue({});
      mockPostHashtagRepo.save.mockResolvedValue({});
      mockHashtagRepo.increment.mockResolvedValue({});
      mockMentionRepo.delete.mockResolvedValue({});
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.update('post-uuid-1234', 'user-uuid-1234', updateDto);

      // Should decrement old hashtag count
      expect(mockHashtagRepo.decrement).toHaveBeenCalled();
      // Should delete old hashtag relations
      expect(mockPostHashtagRepo.delete).toHaveBeenCalledWith({
        postId: 'post-uuid-1234',
      });
      // Should create new hashtag
      expect(mockPostHashtagRepo.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a post successfully', async () => {
      mockPostRepo.findOne.mockResolvedValue({ ...mockPost, images: [] });
      mockPostRepo.softDelete.mockResolvedValue({ affected: 1 });
      mockPostHashtagRepo.find.mockResolvedValue([]);

      await service.delete('post-uuid-1234', 'user-uuid-1234');

      expect(mockPostRepo.softDelete).toHaveBeenCalledWith('post-uuid-1234');
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPostRepo.findOne.mockResolvedValue(mockPost);

      await expect(
        service.delete('post-uuid-1234', 'different-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should delete associated images from R2', async () => {
      mockPostRepo.findOne.mockResolvedValue({
        ...mockPost,
        images: [mockImage],
      });
      mockPostRepo.softDelete.mockResolvedValue({ affected: 1 });
      mockMediaService.deleteImage.mockResolvedValue(undefined);
      mockPostHashtagRepo.find.mockResolvedValue([]);

      await service.delete('post-uuid-1234', 'user-uuid-1234');

      expect(mockMediaService.deleteImage).toHaveBeenCalledWith(mockImage.url);
    });

    it('should decrement hashtag counts on delete', async () => {
      mockPostRepo.findOne.mockResolvedValue({ ...mockPost, images: [] });
      mockPostRepo.softDelete.mockResolvedValue({ affected: 1 });
      mockPostHashtagRepo.find.mockResolvedValue([
        { hashtagId: 'hashtag-uuid-1234' },
      ]);
      mockHashtagRepo.decrement.mockResolvedValue({});
      mockPostHashtagRepo.delete.mockResolvedValue({});

      await service.delete('post-uuid-1234', 'user-uuid-1234');

      expect(mockHashtagRepo.decrement).toHaveBeenCalled();
      expect(mockPostHashtagRepo.delete).toHaveBeenCalledWith({
        postId: 'post-uuid-1234',
      });
    });

    it('should decrement share count if deleting a repost', async () => {
      const repost = {
        ...mockPost,
        originalPostId: 'original-post-uuid',
        images: [],
      };
      mockPostRepo.findOne.mockResolvedValue(repost);
      mockPostRepo.softDelete.mockResolvedValue({ affected: 1 });
      mockPostRepo.decrement.mockResolvedValue({});
      mockPostHashtagRepo.find.mockResolvedValue([]);

      await service.delete('post-uuid-1234', 'user-uuid-1234');

      expect(mockPostRepo.decrement).toHaveBeenCalledWith(
        { id: 'original-post-uuid' },
        'sharesCount',
        1,
      );
    });
  });

  describe('like', () => {
    it('should like a post', async () => {
      mockPostRepo.findOne.mockImplementation((options: any) => {
        // First call is from findOne with relations
        if (options?.relations) {
          return Promise.resolve(mockPost);
        }
        // Second call is to get updated likes count
        return Promise.resolve({ ...mockPost, likesCount: 11 });
      });
      mockLikeRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockLikeRepo.create.mockReturnValue(mockLike);
      mockLikeRepo.save.mockResolvedValue(mockLike);
      mockPostRepo.increment.mockResolvedValue({});

      const result = await service.like('post-uuid-1234', 'user-uuid-1234');

      expect(result.isLiked).toBe(true);
      expect(result.likesCount).toBe(11);
      expect(mockLikeRepo.save).toHaveBeenCalled();
      expect(mockPostRepo.increment).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'likesCount',
        1,
      );
    });

    it('should unlike a post if already liked', async () => {
      mockPostRepo.findOne.mockImplementation((options: any) => {
        // First call is from findOne with relations
        if (options?.relations) {
          return Promise.resolve(mockPost);
        }
        // Second call is to get updated likes count
        return Promise.resolve({ ...mockPost, likesCount: 9 });
      });
      mockLikeRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockLike);
      mockLikeRepo.delete.mockResolvedValue({ affected: 1 });
      mockPostRepo.decrement.mockResolvedValue({});

      const result = await service.like('post-uuid-1234', 'user-uuid-1234');

      expect(result.isLiked).toBe(false);
      expect(result.likesCount).toBe(9);
      expect(mockLikeRepo.delete).toHaveBeenCalledWith(mockLike.id);
      expect(mockPostRepo.decrement).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'likesCount',
        1,
      );
    });
  });

  describe('share', () => {
    it('should create a repost successfully', async () => {
      const repost = {
        ...mockPost,
        id: 'repost-uuid',
        originalPostId: 'post-uuid-1234',
      };

      // Mock findOne to return the right data based on which post is being queried
      mockPostRepo.findOne.mockImplementation((options: any) => {
        if (options?.where?.id === 'post-uuid-1234') {
          return Promise.resolve(mockPost);
        }
        if (options?.where?.id === 'repost-uuid') {
          return Promise.resolve(repost);
        }
        return Promise.resolve(mockPost);
      });
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockPostRepo.create.mockReturnValue(repost);
      mockPostRepo.save.mockResolvedValue(repost);
      mockPostRepo.increment.mockResolvedValue({});

      const result = await service.share(
        'post-uuid-1234',
        'user-uuid-5678',
        'Check this out!',
      );

      expect(result).toBeDefined();
      expect(mockPostRepo.create).toHaveBeenCalledWith({
        userId: 'user-uuid-5678',
        content: 'Check this out!',
        originalPostId: 'post-uuid-1234',
        visibility: PostVisibility.PUBLIC,
      });
      expect(mockPostRepo.increment).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'sharesCount',
        1,
      );
    });

    it('should create a repost with empty content', async () => {
      const repost = {
        ...mockPost,
        id: 'repost-uuid',
        originalPostId: 'post-uuid-1234',
        content: '',
      };

      mockPostRepo.findOne.mockImplementation((options: any) => {
        if (options?.where?.id === 'post-uuid-1234') {
          return Promise.resolve(mockPost);
        }
        if (options?.where?.id === 'repost-uuid') {
          return Promise.resolve(repost);
        }
        return Promise.resolve(mockPost);
      });
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockPostRepo.create.mockReturnValue(repost);
      mockPostRepo.save.mockResolvedValue(repost);
      mockPostRepo.increment.mockResolvedValue({});

      const result = await service.share('post-uuid-1234', 'user-uuid-5678');

      expect(result).toBeDefined();
      expect(mockPostRepo.create).toHaveBeenCalledWith({
        userId: 'user-uuid-5678',
        content: '',
        originalPostId: 'post-uuid-1234',
        visibility: PostVisibility.PUBLIC,
      });
    });
  });

  describe('getFeed', () => {
    it('should return feed with posts from followed users', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockPost]),
      };

      mockBlockRepo.find.mockResolvedValue([]);
      mockFollowRepo.find.mockResolvedValue([
        { followingId: 'followed-user-uuid' },
      ]);
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockLikeRepo.find.mockResolvedValue([]);

      const result = await service.getFeed('user-uuid-1234', { limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should exclude blocked users from feed', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockPost]),
      };

      mockBlockRepo.find.mockResolvedValue([
        { blockerId: 'user-uuid-1234', blockedId: 'blocked-user-id' },
      ]);
      mockFollowRepo.find.mockResolvedValue([]);
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockLikeRepo.find.mockResolvedValue([]);

      await service.getFeed('user-uuid-1234', { limit: 20 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'post.user_id NOT IN (:...blockedUsers)',
        { blockedUsers: ['blocked-user-id'] },
      );
    });

    it('should show popular public posts for users with no follows', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockPost]),
      };

      mockBlockRepo.find.mockResolvedValue([]);
      mockFollowRepo.find.mockResolvedValue([]); // No following
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockLikeRepo.find.mockResolvedValue([]);

      await service.getFeed('user-uuid-1234', { limit: 20 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'post.visibility = :public',
        {
          public: PostVisibility.PUBLIC,
        },
      );
    });

    it('should support cursor-based pagination', async () => {
      const cursorPost = {
        ...mockPost,
        id: 'cursor-post-id',
        createdAt: new Date('2024-01-01'),
      };
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockPost]),
      };

      mockBlockRepo.find.mockResolvedValue([]);
      mockFollowRepo.find.mockResolvedValue([]);
      mockPostRepo.findOne.mockResolvedValue(cursorPost);
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockLikeRepo.find.mockResolvedValue([]);

      await service.getFeed('user-uuid-1234', {
        limit: 20,
        cursor: 'cursor-post-id',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'post.created_at < :cursorDate',
        {
          cursorDate: cursorPost.createdAt,
        },
      );
    });
  });

  describe('getUserPosts', () => {
    it('should return user posts', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPost], 1]),
      };

      mockBlockRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.findOne.mockResolvedValue(null);
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockLikeRepo.find.mockResolvedValue([]);

      const result = await service.getUserPosts('user-uuid-1234', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should return empty for blocked users', async () => {
      mockBlockRepo.findOne.mockResolvedValue({ id: 'block-id' });

      const result = await service.getUserPosts(
        'blocked-user',
        { page: 1, limit: 20 },
        'user-uuid-1234',
      );

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getTrendingPosts', () => {
    it('should return trending posts sorted by engagement', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPost], 1]),
      };

      mockBlockRepo.find.mockResolvedValue([]);
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockLikeRepo.find.mockResolvedValue([]);

      const result = await service.getTrendingPosts({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      // Should order by engagement formula
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        '(post.likes_count + post.comments_count * 2 + post.shares_count * 3)',
        'DESC',
      );
    });

    it('should exclude blocked users from trending', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPost], 1]),
      };

      mockBlockRepo.find.mockResolvedValue([
        { blockerId: 'user-uuid-1234', blockedId: 'blocked-user-id' },
      ]);
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockLikeRepo.find.mockResolvedValue([]);

      await service.getTrendingPosts({ page: 1, limit: 20 }, 'user-uuid-1234');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'post.user_id NOT IN (:...blockedUsers)',
        { blockedUsers: ['blocked-user-id'] },
      );
    });
  });

  describe('getTrendingHashtags', () => {
    it('should return trending hashtags', async () => {
      const mockQueryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockHashtag]),
      };

      mockHashtagRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTrendingHashtags({
        limit: 10,
        hours: 24,
      });

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'COUNT(ph.post_id)',
        'DESC',
      );
    });
  });

  describe('getByHashtag', () => {
    it('should return posts with specific hashtag', async () => {
      const mockQueryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPost], 1]),
      };

      mockHashtagRepo.findOne.mockResolvedValue(mockHashtag);
      mockBlockRepo.find.mockResolvedValue([]);
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockLikeRepo.find.mockResolvedValue([]);

      const result = await service.getByHashtag('trending', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'ph.hashtag_id = :hashtagId',
        {
          hashtagId: mockHashtag.id,
        },
      );
    });

    it('should return empty for non-existent hashtag', async () => {
      mockHashtagRepo.findOne.mockResolvedValue(null);

      const result = await service.getByHashtag('nonexistent', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should normalize hashtag name (remove # prefix)', async () => {
      mockHashtagRepo.findOne.mockResolvedValue(mockHashtag);
      mockBlockRepo.find.mockResolvedValue([]);
      const mockQueryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getByHashtag('#Trending', { page: 1, limit: 20 });

      expect(mockHashtagRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'trending' },
      });
    });
  });
});
