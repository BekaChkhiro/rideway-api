import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ForumThreadsService } from '../forum-threads.service.js';
import { ForumThread } from '../entities/forum-thread.entity.js';
import { ThreadReply } from '../entities/thread-reply.entity.js';
import { ThreadSortBy } from '../dto/thread-query.dto.js';

describe('ForumThreadsService', () => {
  let service: ForumThreadsService;
  let mockThreadRepo: Record<string, Mock>;
  let mockReplyRepo: Record<string, Mock>;
  let mockLikeRepo: Record<string, Mock>;
  let mockSubscriptionRepo: Record<string, Mock>;
  let mockReplyLikeRepo: Record<string, Mock>;
  let mockCategoriesService: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;
  let mockRedisClient: Record<string, Mock>;
  let mockQueryBuilder: Record<string, Mock>;

  const mockCategory = {
    id: 'category-uuid-1234',
    name: 'General Discussion',
    slug: 'general-discussion',
  };

  const mockThread: Partial<ForumThread> = {
    id: 'thread-uuid-1234',
    userId: 'user-uuid-1234',
    categoryId: 'category-uuid-1234',
    title: 'Best motorcycle for beginners?',
    content: 'Looking for advice on my first bike.',
    viewsCount: 100,
    repliesCount: 15,
    likesCount: 25,
    isPinned: false,
    isLocked: false,
    lastReplyAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReply: Partial<ThreadReply> = {
    id: 'reply-uuid-1234',
    threadId: 'thread-uuid-1234',
    userId: 'user-uuid-5678',
    content: 'I recommend starting with a 300cc bike.',
    likesCount: 5,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLike = {
    id: 'like-uuid-1234',
    threadId: 'thread-uuid-1234',
    userId: 'user-uuid-1234',
  };

  const mockSubscription = {
    id: 'sub-uuid-1234',
    threadId: 'thread-uuid-1234',
    userId: 'user-uuid-1234',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockQueryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };

    mockThreadRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      increment: vi.fn(),
      decrement: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockReplyRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
      update: vi.fn(),
      softDelete: vi.fn(),
      increment: vi.fn(),
      decrement: vi.fn(),
    };

    mockLikeRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    };

    mockSubscriptionRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    };

    mockReplyLikeRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    };

    mockCategoriesService = {
      findOne: vi.fn().mockResolvedValue(mockCategory),
      incrementThreadsCount: vi.fn(),
      decrementThreadsCount: vi.fn(),
    };

    mockRedisClient = {
      incr: vi.fn().mockResolvedValue(1),
      getdel: vi.fn().mockResolvedValue(null),
    };

    mockRedisService = {
      getClient: vi.fn().mockReturnValue(mockRedisClient),
      keys: vi.fn().mockResolvedValue([]),
    };

    service = new ForumThreadsService(
      mockThreadRepo as any,
      mockReplyRepo as any,
      mockLikeRepo as any,
      mockSubscriptionRepo as any,
      mockReplyLikeRepo as any,
      mockCategoriesService as any,
      mockRedisService as any,
    );
  });

  describe('create', () => {
    it('should create thread and increment category count', async () => {
      const dto = {
        categoryId: 'category-uuid-1234',
        title: 'New thread',
        content: 'Thread content',
      };

      mockThreadRepo.create.mockReturnValue({ ...mockThread, ...dto });
      mockThreadRepo.save.mockResolvedValue({
        ...mockThread,
        id: 'new-thread-id',
      });
      mockThreadRepo.findOne.mockResolvedValue({
        ...mockThread,
        id: 'new-thread-id',
      });
      mockSubscriptionRepo.findOne.mockResolvedValue(null);
      mockSubscriptionRepo.create.mockReturnValue(mockSubscription);
      mockSubscriptionRepo.save.mockResolvedValue(mockSubscription);
      mockLikeRepo.findOne.mockResolvedValue(null);

      const result = await service.create('user-uuid-1234', dto);

      expect(mockCategoriesService.findOne).toHaveBeenCalledWith(
        'category-uuid-1234',
      );
      expect(mockThreadRepo.save).toHaveBeenCalled();
      expect(mockCategoriesService.incrementThreadsCount).toHaveBeenCalledWith(
        'category-uuid-1234',
      );
      expect(result).toBeDefined();
    });

    it('should auto-subscribe creator to thread', async () => {
      const dto = {
        categoryId: 'category-uuid-1234',
        title: 'New thread',
        content: 'Thread content',
      };

      mockThreadRepo.create.mockReturnValue(mockThread);
      mockThreadRepo.save.mockResolvedValue({
        ...mockThread,
        id: 'new-thread-id',
      });
      mockThreadRepo.findOne.mockResolvedValue({
        ...mockThread,
        id: 'new-thread-id',
      });
      mockSubscriptionRepo.findOne.mockResolvedValue(null);
      mockSubscriptionRepo.create.mockReturnValue(mockSubscription);
      mockSubscriptionRepo.save.mockResolvedValue(mockSubscription);
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.create('user-uuid-1234', dto);

      expect(mockSubscriptionRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if category not found', async () => {
      mockCategoriesService.findOne.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(
        service.create('user-uuid-1234', {
          categoryId: 'non-existent',
          title: 'Test',
          content: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated threads', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockThread], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by category', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ categoryId: 'category-uuid-1234' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'thread.category_id = :categoryId',
        { categoryId: 'category-uuid-1234' },
      );
    });

    it('should sort pinned threads first', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'thread.is_pinned',
        'DESC',
      );
    });

    it('should sort by latest (default)', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: ThreadSortBy.LATEST });

      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'thread.created_at',
        'DESC',
      );
    });

    it('should sort by active (last reply)', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: ThreadSortBy.ACTIVE });

      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'COALESCE(thread.last_reply_at, thread.created_at)',
        'DESC',
      );
    });

    it('should sort by popular (replies count)', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: ThreadSortBy.POPULAR });

      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'thread.replies_count',
        'DESC',
      );
    });

    it('should mark liked and subscribed for current user', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [{ ...mockThread }],
        1,
      ]);
      mockLikeRepo.find.mockResolvedValue([mockLike]);
      mockSubscriptionRepo.find.mockResolvedValue([mockSubscription]);

      const result = await service.findAll({}, 'user-uuid-1234');

      expect(result.data[0].isLiked).toBe(true);
      expect(result.data[0].isSubscribed).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return thread by id', async () => {
      mockThreadRepo.findOne.mockResolvedValue(mockThread);

      const result = await service.findOne('thread-uuid-1234');

      expect(result.id).toBe('thread-uuid-1234');
    });

    it('should throw NotFoundException if thread not found', async () => {
      mockThreadRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should mark isLiked and isSubscribed for current user', async () => {
      mockThreadRepo.findOne.mockResolvedValue({ ...mockThread });
      mockLikeRepo.findOne.mockResolvedValue(mockLike);
      mockSubscriptionRepo.findOne.mockResolvedValue(mockSubscription);

      const result = await service.findOne(
        'thread-uuid-1234',
        'user-uuid-1234',
      );

      expect(result.isLiked).toBe(true);
      expect(result.isSubscribed).toBe(true);
    });
  });

  describe('update', () => {
    it('should update thread', async () => {
      mockThreadRepo.findOne.mockResolvedValue({ ...mockThread });
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockSubscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.update(
        'thread-uuid-1234',
        'user-uuid-1234',
        {
          title: 'Updated title',
        },
      );

      expect(mockThreadRepo.update).toHaveBeenCalledWith('thread-uuid-1234', {
        title: 'Updated title',
      });
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockThreadRepo.findOne.mockResolvedValue(mockThread);

      await expect(
        service.update('thread-uuid-1234', 'other-user', { title: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should soft delete thread and decrement category count', async () => {
      mockThreadRepo.findOne.mockResolvedValue(mockThread);

      await service.delete('thread-uuid-1234', 'user-uuid-1234');

      expect(mockThreadRepo.softDelete).toHaveBeenCalledWith(
        'thread-uuid-1234',
      );
      expect(mockCategoriesService.decrementThreadsCount).toHaveBeenCalledWith(
        'category-uuid-1234',
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockThreadRepo.findOne.mockResolvedValue(mockThread);

      await expect(
        service.delete('thread-uuid-1234', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('incrementViews', () => {
    it('should increment view count in Redis', async () => {
      await service.incrementViews('thread-uuid-1234');

      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        'forum:thread:views:thread-uuid-1234',
      );
    });
  });

  describe('like', () => {
    it('should like a thread', async () => {
      mockThreadRepo.findOne.mockImplementation((options: any) => {
        if (options?.relations) {
          return Promise.resolve(mockThread);
        }
        return Promise.resolve({ ...mockThread, likesCount: 26 });
      });
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockSubscriptionRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.create.mockReturnValue(mockLike);
      mockLikeRepo.save.mockResolvedValue(mockLike);

      const result = await service.like('thread-uuid-1234', 'user-uuid-1234');

      expect(result.isLiked).toBe(true);
      expect(result.likesCount).toBe(26);
      expect(mockLikeRepo.save).toHaveBeenCalled();
      expect(mockThreadRepo.increment).toHaveBeenCalledWith(
        { id: 'thread-uuid-1234' },
        'likesCount',
        1,
      );
    });

    it('should unlike a thread if already liked', async () => {
      mockThreadRepo.findOne.mockImplementation((options: any) => {
        if (options?.relations) {
          return Promise.resolve(mockThread);
        }
        return Promise.resolve({ ...mockThread, likesCount: 24 });
      });
      mockLikeRepo.findOne.mockResolvedValue(mockLike);
      mockSubscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.like('thread-uuid-1234', 'user-uuid-1234');

      expect(result.isLiked).toBe(false);
      expect(result.likesCount).toBe(24);
      expect(mockLikeRepo.delete).toHaveBeenCalledWith(mockLike.id);
      expect(mockThreadRepo.decrement).toHaveBeenCalledWith(
        { id: 'thread-uuid-1234' },
        'likesCount',
        1,
      );
    });
  });

  describe('pin', () => {
    it('should toggle pin status', async () => {
      mockThreadRepo.findOne.mockResolvedValue({
        ...mockThread,
        isPinned: false,
      });

      await service.pin('thread-uuid-1234');

      expect(mockThreadRepo.update).toHaveBeenCalledWith('thread-uuid-1234', {
        isPinned: true,
      });
    });

    it('should unpin a pinned thread', async () => {
      mockThreadRepo.findOne.mockResolvedValue({
        ...mockThread,
        isPinned: true,
      });

      await service.pin('thread-uuid-1234');

      expect(mockThreadRepo.update).toHaveBeenCalledWith('thread-uuid-1234', {
        isPinned: false,
      });
    });
  });

  describe('lock', () => {
    it('should toggle lock status', async () => {
      mockThreadRepo.findOne.mockResolvedValue({
        ...mockThread,
        isLocked: false,
      });

      await service.lock('thread-uuid-1234');

      expect(mockThreadRepo.update).toHaveBeenCalledWith('thread-uuid-1234', {
        isLocked: true,
      });
    });

    it('should unlock a locked thread', async () => {
      mockThreadRepo.findOne.mockResolvedValue({
        ...mockThread,
        isLocked: true,
      });

      await service.lock('thread-uuid-1234');

      expect(mockThreadRepo.update).toHaveBeenCalledWith('thread-uuid-1234', {
        isLocked: false,
      });
    });
  });

  describe('subscribe', () => {
    it('should subscribe to a thread', async () => {
      mockThreadRepo.findOne.mockResolvedValue(mockThread);
      mockSubscriptionRepo.findOne.mockResolvedValue(null);
      mockSubscriptionRepo.create.mockReturnValue(mockSubscription);
      mockSubscriptionRepo.save.mockResolvedValue(mockSubscription);

      const result = await service.subscribe(
        'thread-uuid-1234',
        'user-uuid-1234',
      );

      expect(result.isSubscribed).toBe(true);
      expect(mockSubscriptionRepo.save).toHaveBeenCalled();
    });

    it('should unsubscribe if already subscribed', async () => {
      mockThreadRepo.findOne.mockResolvedValue(mockThread);
      mockSubscriptionRepo.findOne.mockResolvedValue(mockSubscription);

      const result = await service.subscribe(
        'thread-uuid-1234',
        'user-uuid-1234',
      );

      expect(result.isSubscribed).toBe(false);
      expect(mockSubscriptionRepo.delete).toHaveBeenCalledWith(
        mockSubscription.id,
      );
    });
  });

  describe('getSubscribers', () => {
    it('should return list of subscriber user IDs', async () => {
      mockSubscriptionRepo.find.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const result = await service.getSubscribers('thread-uuid-1234');

      expect(result).toEqual(['user-1', 'user-2']);
    });
  });

  describe('createReply', () => {
    it('should create reply and update thread', async () => {
      mockThreadRepo.findOne.mockResolvedValue({
        ...mockThread,
        isLocked: false,
      });
      mockReplyRepo.create.mockReturnValue(mockReply);
      mockReplyRepo.save.mockResolvedValue({
        ...mockReply,
        id: 'new-reply-id',
      });
      mockReplyRepo.findOne.mockResolvedValue({
        ...mockReply,
        id: 'new-reply-id',
      });
      mockReplyLikeRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockSubscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.createReply(
        'thread-uuid-1234',
        'user-uuid-5678',
        { content: 'My reply' },
      );

      expect(mockReplyRepo.save).toHaveBeenCalled();
      expect(mockThreadRepo.update).toHaveBeenCalledWith('thread-uuid-1234', {
        repliesCount: expect.any(Function),
        lastReplyAt: expect.any(Date),
        lastReplyUserId: 'user-uuid-5678',
      });
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if thread is locked', async () => {
      mockThreadRepo.findOne.mockResolvedValue({
        ...mockThread,
        isLocked: true,
      });

      await expect(
        service.createReply('thread-uuid-1234', 'user-uuid-1234', {
          content: 'Reply',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should support nested replies with parentId', async () => {
      mockThreadRepo.findOne.mockResolvedValue({
        ...mockThread,
        isLocked: false,
      });
      mockReplyRepo.create.mockReturnValue({
        ...mockReply,
        parentId: 'parent-reply-id',
      });
      mockReplyRepo.save.mockResolvedValue({
        ...mockReply,
        id: 'nested-reply-id',
      });
      mockReplyRepo.findOne.mockResolvedValue({
        ...mockReply,
        id: 'nested-reply-id',
        parentId: 'parent-reply-id',
      });
      mockReplyLikeRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockSubscriptionRepo.findOne.mockResolvedValue(null);

      await service.createReply('thread-uuid-1234', 'user-uuid-1234', {
        content: 'Nested reply',
        parentId: 'parent-reply-id',
      });

      expect(mockReplyRepo.create).toHaveBeenCalledWith({
        threadId: 'thread-uuid-1234',
        userId: 'user-uuid-1234',
        parentId: 'parent-reply-id',
        content: 'Nested reply',
      });
    });
  });

  describe('findReplies', () => {
    it('should return paginated replies', async () => {
      mockReplyRepo.findAndCount.mockResolvedValue([[mockReply], 1]);

      const result = await service.findReplies('thread-uuid-1234', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should mark liked replies for current user', async () => {
      mockReplyRepo.findAndCount.mockResolvedValue([[{ ...mockReply }], 1]);
      mockReplyLikeRepo.find.mockResolvedValue([
        { replyId: 'reply-uuid-1234' },
      ]);

      const result = await service.findReplies(
        'thread-uuid-1234',
        1,
        20,
        'user-uuid-1234',
      );

      expect(result.data[0].isLiked).toBe(true);
    });
  });

  describe('updateReply', () => {
    it('should update reply and set isEdited', async () => {
      mockReplyRepo.findOne.mockResolvedValue({ ...mockReply });
      mockReplyLikeRepo.findOne.mockResolvedValue(null);

      await service.updateReply('reply-uuid-1234', 'user-uuid-5678', {
        content: 'Updated content',
      });

      expect(mockReplyRepo.update).toHaveBeenCalledWith('reply-uuid-1234', {
        content: 'Updated content',
        isEdited: true,
      });
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockReplyRepo.findOne.mockResolvedValue(mockReply);

      await expect(
        service.updateReply('reply-uuid-1234', 'other-user', {
          content: 'Test',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteReply', () => {
    it('should soft delete reply and decrement thread count', async () => {
      mockReplyRepo.findOne.mockResolvedValue({ ...mockReply });
      mockReplyLikeRepo.findOne.mockResolvedValue(null);

      await service.deleteReply('reply-uuid-1234', 'user-uuid-5678');

      expect(mockReplyRepo.softDelete).toHaveBeenCalledWith('reply-uuid-1234');
      expect(mockThreadRepo.decrement).toHaveBeenCalledWith(
        { id: 'thread-uuid-1234' },
        'repliesCount',
        1,
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockReplyRepo.findOne.mockResolvedValue(mockReply);

      await expect(
        service.deleteReply('reply-uuid-1234', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('likeReply', () => {
    it('should like a reply', async () => {
      mockReplyRepo.findOne.mockImplementation((options: any) => {
        if (options?.relations) {
          return Promise.resolve(mockReply);
        }
        return Promise.resolve({ ...mockReply, likesCount: 6 });
      });
      mockReplyLikeRepo.findOne.mockResolvedValue(null);
      mockReplyLikeRepo.create.mockReturnValue({ replyId: 'reply-uuid-1234' });
      mockReplyLikeRepo.save.mockResolvedValue({ id: 'like-id' });

      const result = await service.likeReply(
        'reply-uuid-1234',
        'user-uuid-1234',
      );

      expect(result.isLiked).toBe(true);
      expect(result.likesCount).toBe(6);
      expect(mockReplyLikeRepo.save).toHaveBeenCalled();
      expect(mockReplyRepo.increment).toHaveBeenCalledWith(
        { id: 'reply-uuid-1234' },
        'likesCount',
        1,
      );
    });

    it('should unlike a reply if already liked', async () => {
      const existingLike = { id: 'like-id', replyId: 'reply-uuid-1234' };
      mockReplyRepo.findOne.mockImplementation((options: any) => {
        if (options?.relations) {
          return Promise.resolve(mockReply);
        }
        return Promise.resolve({ ...mockReply, likesCount: 4 });
      });
      mockReplyLikeRepo.findOne.mockResolvedValue(existingLike);

      const result = await service.likeReply(
        'reply-uuid-1234',
        'user-uuid-1234',
      );

      expect(result.isLiked).toBe(false);
      expect(result.likesCount).toBe(4);
      expect(mockReplyLikeRepo.delete).toHaveBeenCalledWith('like-id');
      expect(mockReplyRepo.decrement).toHaveBeenCalledWith(
        { id: 'reply-uuid-1234' },
        'likesCount',
        1,
      );
    });
  });
});
