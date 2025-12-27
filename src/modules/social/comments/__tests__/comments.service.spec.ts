import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CommentsService } from '../comments.service.js';
import { Comment } from '../entities/comment.entity.js';
import { CommentLike } from '../entities/comment-like.entity.js';
import { CreateCommentDto } from '../dto/create-comment.dto.js';
import { UpdateCommentDto } from '../dto/update-comment.dto.js';
import { CommentSortBy } from '../dto/comment-query.dto.js';

describe('CommentsService', () => {
  let service: CommentsService;
  let mockCommentRepo: Record<string, Mock>;
  let mockLikeRepo: Record<string, Mock>;
  let mockPostRepo: Record<string, Mock>;
  let mockBlockRepo: Record<string, Mock>;
  let mockQueryBuilder: Record<string, Mock>;

  const mockPost = {
    id: 'post-uuid-1234',
    userId: 'post-owner-uuid',
    content: 'Test post content',
    commentsCount: 5,
  };

  const mockComment: Partial<Comment> = {
    id: 'comment-uuid-1234',
    userId: 'user-uuid-1234',
    postId: 'post-uuid-1234',
    parentId: undefined,
    content: 'Test comment',
    likesCount: 10,
    repliesCount: 3,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReply: Partial<Comment> = {
    id: 'reply-uuid-1234',
    userId: 'user-uuid-5678',
    postId: 'post-uuid-1234',
    parentId: 'comment-uuid-1234',
    content: 'Test reply',
    likesCount: 2,
    repliesCount: 0,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCommentLike: Partial<CommentLike> = {
    id: 'like-uuid-1234',
    userId: 'user-uuid-1234',
    commentId: 'comment-uuid-1234',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockQueryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };

    mockCommentRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      increment: vi.fn(),
      decrement: vi.fn(),
      count: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockLikeRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      delete: vi.fn(),
    };

    mockPostRepo = {
      findOne: vi.fn(),
      increment: vi.fn(),
      decrement: vi.fn(),
    };

    mockBlockRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    service = new CommentsService(
      mockCommentRepo as any,
      mockLikeRepo as any,
      mockPostRepo as any,
      mockBlockRepo as any,
    );
  });

  describe('create', () => {
    it('should add comment to post', async () => {
      const dto: CreateCommentDto = {
        content: 'Great post!',
      };

      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockCommentRepo.create.mockReturnValue({
        ...mockComment,
        content: dto.content,
      });
      mockCommentRepo.save.mockResolvedValue({
        ...mockComment,
        id: 'new-comment-id',
        content: dto.content,
      });
      mockCommentRepo.findOne.mockResolvedValue({
        ...mockComment,
        id: 'new-comment-id',
        content: dto.content,
      });

      const result = await service.create('user-uuid-1234', 'post-uuid-1234', dto);

      expect(mockCommentRepo.create).toHaveBeenCalledWith({
        userId: 'user-uuid-1234',
        postId: 'post-uuid-1234',
        parentId: undefined,
        content: 'Great post!',
      });
      expect(mockCommentRepo.save).toHaveBeenCalled();
      expect(mockPostRepo.increment).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'commentsCount',
        1,
      );
      expect(result.content).toBe('Great post!');
    });

    it('should throw NotFoundException if post not found', async () => {
      mockPostRepo.findOne.mockResolvedValue(null);

      const dto: CreateCommentDto = {
        content: 'Comment on non-existent post',
      };

      await expect(
        service.create('user-uuid-1234', 'non-existent-post', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should add reply to comment', async () => {
      const dto: CreateCommentDto = {
        content: 'Reply to your comment',
        parentId: 'comment-uuid-1234',
      };

      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockCommentRepo.findOne.mockImplementation((options: any) => {
        if (options?.where?.id === 'comment-uuid-1234') {
          return Promise.resolve(mockComment);
        }
        if (options?.where?.id === 'new-reply-id') {
          return Promise.resolve({
            ...mockReply,
            id: 'new-reply-id',
            content: dto.content,
          });
        }
        return Promise.resolve(null);
      });
      mockCommentRepo.create.mockReturnValue({
        ...mockReply,
        content: dto.content,
      });
      mockCommentRepo.save.mockResolvedValue({
        ...mockReply,
        id: 'new-reply-id',
        content: dto.content,
      });

      const result = await service.create('user-uuid-5678', 'post-uuid-1234', dto);

      expect(mockCommentRepo.create).toHaveBeenCalledWith({
        userId: 'user-uuid-5678',
        postId: 'post-uuid-1234',
        parentId: 'comment-uuid-1234',
        content: 'Reply to your comment',
      });
      expect(mockCommentRepo.increment).toHaveBeenCalledWith(
        { id: 'comment-uuid-1234' },
        'repliesCount',
        1,
      );
      expect(mockPostRepo.increment).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'commentsCount',
        1,
      );
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if parent comment not found', async () => {
      const dto: CreateCommentDto = {
        content: 'Reply to non-existent comment',
        parentId: 'non-existent-comment',
      };

      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('user-uuid-1234', 'post-uuid-1234', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should flatten nested replies (reply to reply goes to parent level)', async () => {
      const nestedReply: Partial<Comment> = {
        id: 'nested-reply-uuid',
        parentId: 'comment-uuid-1234', // This reply has a parent
        postId: 'post-uuid-1234',
        content: 'First level reply',
      };

      const dto: CreateCommentDto = {
        content: 'Reply to a reply',
        parentId: 'nested-reply-uuid', // Trying to reply to a reply
      };

      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockCommentRepo.findOne.mockImplementation((options: any) => {
        if (options?.where?.id === 'nested-reply-uuid') {
          return Promise.resolve(nestedReply);
        }
        if (options?.where?.id === 'flattened-reply-id') {
          return Promise.resolve({
            id: 'flattened-reply-id',
            parentId: 'comment-uuid-1234', // Should be flattened to original parent
            content: dto.content,
          });
        }
        return Promise.resolve(null);
      });
      mockCommentRepo.create.mockReturnValue({
        parentId: 'comment-uuid-1234',
        content: dto.content,
      });
      mockCommentRepo.save.mockResolvedValue({
        id: 'flattened-reply-id',
        parentId: 'comment-uuid-1234',
        content: dto.content,
      });

      await service.create('user-uuid-1234', 'post-uuid-1234', dto);

      // Should increment the original parent's repliesCount, not the nested reply's
      expect(mockCommentRepo.increment).toHaveBeenCalledWith(
        { id: 'comment-uuid-1234' },
        'repliesCount',
        1,
      );
      // Should create with flattened parentId
      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'comment-uuid-1234',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return comment by id', async () => {
      mockCommentRepo.findOne.mockResolvedValue(mockComment);

      const result = await service.findOne('comment-uuid-1234');

      expect(result).toBeDefined();
      expect(result.id).toBe('comment-uuid-1234');
    });

    it('should throw NotFoundException if comment not found', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should mark isLiked when user has liked', async () => {
      mockCommentRepo.findOne.mockResolvedValue({ ...mockComment });
      mockLikeRepo.findOne.mockResolvedValue(mockCommentLike);

      const result = await service.findOne('comment-uuid-1234', 'user-uuid-1234');

      expect(result.isLiked).toBe(true);
    });

    it('should not mark isLiked when user has not liked', async () => {
      mockCommentRepo.findOne.mockResolvedValue({ ...mockComment });
      mockLikeRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('comment-uuid-1234', 'user-uuid-1234');

      expect(result.isLiked).toBe(false);
    });
  });

  describe('findByPost', () => {
    it('should return comments for a post', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockComment]);
      mockCommentRepo.find.mockResolvedValue([]); // No replies
      mockLikeRepo.find.mockResolvedValue([]);

      const result = await service.findByPost('post-uuid-1234', {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('comment-uuid-1234');
    });

    it('should filter only root comments (parentId IS NULL)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByPost('post-uuid-1234', {});

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'comment.parent_id IS NULL',
      );
    });

    it('should load first 3 replies for each comment', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockComment]);
      mockCommentRepo.find.mockResolvedValue([mockReply]);
      mockLikeRepo.find.mockResolvedValue([]);

      const result = await service.findByPost('post-uuid-1234', {});

      expect(result.data[0].replies).toHaveLength(1);
      expect(mockCommentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: 'comment-uuid-1234' },
          take: 3,
        }),
      );
    });

    it('should exclude blocked users from comments', async () => {
      mockBlockRepo.find.mockResolvedValue([
        { blockerId: 'current-user', blockedId: 'blocked-user' },
      ]);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByPost('post-uuid-1234', {}, 'current-user');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'comment.user_id NOT IN (:...blockedUsers)',
        { blockedUsers: ['blocked-user'] },
      );
    });

    it('should sort by newest by default', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByPost('post-uuid-1234', { sortBy: CommentSortBy.NEWEST });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'comment.created_at',
        'DESC',
      );
    });

    it('should sort by oldest when specified', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByPost('post-uuid-1234', { sortBy: CommentSortBy.OLDEST });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'comment.created_at',
        'ASC',
      );
    });

    it('should sort by popular when specified', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByPost('post-uuid-1234', { sortBy: CommentSortBy.POPULAR });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'comment.likes_count',
        'DESC',
      );
    });

    it('should support cursor pagination', async () => {
      const cursorComment = { ...mockComment, createdAt: new Date('2024-01-15') };
      mockCommentRepo.findOne.mockResolvedValue(cursorComment);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByPost('post-uuid-1234', { cursor: 'comment-uuid-1234' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'comment.created_at < :cursorDate',
        { cursorDate: cursorComment.createdAt },
      );
    });

    it('should return hasMore correctly', async () => {
      // Return limit + 1 items to indicate hasMore
      const comments = Array(21).fill({ ...mockComment });
      mockQueryBuilder.getMany.mockResolvedValue(comments);
      mockCommentRepo.find.mockResolvedValue([]);
      mockLikeRepo.find.mockResolvedValue([]);

      const result = await service.findByPost('post-uuid-1234', { limit: 20 });

      expect(result.meta.hasMore).toBe(true);
      expect(result.data).toHaveLength(20); // Should pop the extra item
    });
  });

  describe('findReplies', () => {
    it('should return paginated replies for a comment', async () => {
      mockCommentRepo.findOne.mockResolvedValue(mockComment);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockReply], 1]);
      mockLikeRepo.find.mockResolvedValue([]);

      const result = await service.findReplies('comment-uuid-1234', { page: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should throw NotFoundException if parent comment not found', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findReplies('non-existent-id', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should edit comment content', async () => {
      const dto: UpdateCommentDto = {
        content: 'Updated comment content',
      };

      let callCount = 0;
      mockCommentRepo.findOne.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - ownership check
          return Promise.resolve({ ...mockComment });
        }
        // Second call - return updated comment
        return Promise.resolve({
          ...mockComment,
          content: dto.content,
          isEdited: true,
        });
      });
      mockLikeRepo.findOne.mockResolvedValue(null);

      const result = await service.update(
        'comment-uuid-1234',
        'user-uuid-1234',
        dto,
      );

      expect(mockCommentRepo.update).toHaveBeenCalledWith('comment-uuid-1234', {
        content: 'Updated comment content',
        isEdited: true,
      });
      expect(result.isEdited).toBe(true);
    });

    it('should throw ForbiddenException if not comment owner', async () => {
      mockCommentRepo.findOne.mockResolvedValue(mockComment);

      const dto: UpdateCommentDto = {
        content: 'Trying to edit someone elses comment',
      };

      await expect(
        service.update('comment-uuid-1234', 'other-user-id', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if comment not found', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      const dto: UpdateCommentDto = {
        content: 'Update non-existent',
      };

      await expect(
        service.update('non-existent-id', 'user-uuid-1234', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft delete comment', async () => {
      mockCommentRepo.findOne.mockResolvedValue(mockComment);
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.delete('comment-uuid-1234', 'user-uuid-1234');

      expect(mockCommentRepo.softDelete).toHaveBeenCalledWith('comment-uuid-1234');
    });

    it('should decrement post commentsCount on delete', async () => {
      mockCommentRepo.findOne.mockResolvedValue({
        ...mockComment,
        repliesCount: 0,
      });
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.delete('comment-uuid-1234', 'user-uuid-1234');

      expect(mockPostRepo.decrement).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'commentsCount',
        1,
      );
    });

    it('should also decrement commentsCount by repliesCount when deleting parent', async () => {
      const commentWithReplies = {
        ...mockComment,
        repliesCount: 5,
      };

      mockCommentRepo.findOne.mockResolvedValue(commentWithReplies);
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.delete('comment-uuid-1234', 'user-uuid-1234');

      // First call: decrement by 1 for the comment itself
      expect(mockPostRepo.decrement).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'commentsCount',
        1,
      );
      // Second call: decrement by repliesCount
      expect(mockPostRepo.decrement).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'commentsCount',
        5,
      );
    });

    it('should decrement parent repliesCount when deleting reply', async () => {
      mockCommentRepo.findOne.mockResolvedValue({
        ...mockReply,
        userId: 'user-uuid-1234',
      });
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.delete('reply-uuid-1234', 'user-uuid-1234');

      expect(mockCommentRepo.decrement).toHaveBeenCalledWith(
        { id: 'comment-uuid-1234' },
        'repliesCount',
        1,
      );
    });

    it('should throw ForbiddenException if not comment owner', async () => {
      mockCommentRepo.findOne.mockResolvedValue(mockComment);

      await expect(
        service.delete('comment-uuid-1234', 'other-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if comment not found', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.delete('non-existent-id', 'user-uuid-1234'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('like', () => {
    it('should like a comment', async () => {
      mockCommentRepo.findOne.mockImplementation((options: any) => {
        if (options?.relations) {
          return Promise.resolve(mockComment);
        }
        return Promise.resolve({ ...mockComment, likesCount: 11 });
      });
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.create.mockReturnValue(mockCommentLike);
      mockLikeRepo.save.mockResolvedValue(mockCommentLike);

      const result = await service.like('comment-uuid-1234', 'user-uuid-1234');

      expect(result.isLiked).toBe(true);
      expect(result.likesCount).toBe(11);
      expect(mockLikeRepo.save).toHaveBeenCalled();
      expect(mockCommentRepo.increment).toHaveBeenCalledWith(
        { id: 'comment-uuid-1234' },
        'likesCount',
        1,
      );
    });

    it('should unlike a comment if already liked', async () => {
      mockCommentRepo.findOne.mockImplementation((options: any) => {
        if (options?.relations) {
          return Promise.resolve(mockComment);
        }
        return Promise.resolve({ ...mockComment, likesCount: 9 });
      });
      mockLikeRepo.findOne.mockResolvedValue(mockCommentLike);

      const result = await service.like('comment-uuid-1234', 'user-uuid-1234');

      expect(result.isLiked).toBe(false);
      expect(result.likesCount).toBe(9);
      expect(mockLikeRepo.delete).toHaveBeenCalledWith(mockCommentLike.id);
      expect(mockCommentRepo.decrement).toHaveBeenCalledWith(
        { id: 'comment-uuid-1234' },
        'likesCount',
        1,
      );
    });

    it('should throw NotFoundException if comment not found', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.like('non-existent-id', 'user-uuid-1234'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCommentCount', () => {
    it('should return comment count for post', async () => {
      mockCommentRepo.count.mockResolvedValue(42);

      const result = await service.getCommentCount('post-uuid-1234');

      expect(result).toBe(42);
      expect(mockCommentRepo.count).toHaveBeenCalledWith({
        where: { postId: 'post-uuid-1234' },
      });
    });
  });

  describe('post commentsCount updates', () => {
    it('should increment commentsCount when creating comment', async () => {
      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockCommentRepo.create.mockReturnValue(mockComment);
      mockCommentRepo.save.mockResolvedValue(mockComment);
      mockCommentRepo.findOne.mockResolvedValue(mockComment);

      await service.create('user-uuid-1234', 'post-uuid-1234', {
        content: 'New comment',
      });

      expect(mockPostRepo.increment).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'commentsCount',
        1,
      );
    });

    it('should increment commentsCount when creating reply', async () => {
      mockPostRepo.findOne.mockResolvedValue(mockPost);
      mockCommentRepo.findOne.mockImplementation((options: any) => {
        if (options?.where?.id === 'comment-uuid-1234') {
          return Promise.resolve(mockComment);
        }
        return Promise.resolve(mockReply);
      });
      mockCommentRepo.create.mockReturnValue(mockReply);
      mockCommentRepo.save.mockResolvedValue(mockReply);

      await service.create('user-uuid-1234', 'post-uuid-1234', {
        content: 'Reply',
        parentId: 'comment-uuid-1234',
      });

      expect(mockPostRepo.increment).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'commentsCount',
        1,
      );
    });

    it('should decrement commentsCount when deleting comment', async () => {
      mockCommentRepo.findOne.mockResolvedValue({
        ...mockComment,
        repliesCount: 0,
      });
      mockLikeRepo.findOne.mockResolvedValue(null);

      await service.delete('comment-uuid-1234', 'user-uuid-1234');

      expect(mockPostRepo.decrement).toHaveBeenCalledWith(
        { id: 'post-uuid-1234' },
        'commentsCount',
        1,
      );
    });
  });
});
