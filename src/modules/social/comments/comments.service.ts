import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Comment } from './entities/comment.entity.js';
import { CommentLike } from './entities/comment-like.entity.js';
import { Post } from '../posts/entities/post.entity.js';
import { UserBlock } from '@database/entities/user-block.entity.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';
import { CommentQueryDto, CommentSortBy } from './dto/comment-query.dto.js';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface CursorPaginatedResult<T> {
  data: T[];
  meta: {
    nextCursor?: string;
    hasMore: boolean;
  };
}

interface CommentWithReplies extends Comment {
  replies: Comment[];
}

@Injectable()
export class CommentsService {
  private readonly MAX_NESTING_DEPTH = 2;

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private readonly likeRepository: Repository<CommentLike>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(UserBlock)
    private readonly blockRepository: Repository<UserBlock>,
  ) {}

  async create(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    // Verify post exists
    const post = await this.postRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // If replying, verify parent comment exists and get its depth
    let actualParentId = dto.parentId;
    if (dto.parentId) {
      const parentComment = await this.commentRepository.findOne({
        where: { id: dto.parentId, postId },
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }

      // If parent is already a reply (has parentId), flatten to max depth 2
      // i.e., reply to a reply goes to the same level as the original reply
      if (parentComment.parentId) {
        actualParentId = parentComment.parentId;
      }
    }

    const comment = this.commentRepository.create({
      userId,
      postId,
      parentId: actualParentId,
      content: dto.content,
    });

    const savedComment = await this.commentRepository.save(comment);

    // Update parent's repliesCount if this is a reply
    if (actualParentId) {
      await this.commentRepository.increment(
        { id: actualParentId },
        'repliesCount',
        1,
      );
    }

    // Update post's commentsCount
    await this.postRepository.increment({ id: postId }, 'commentsCount', 1);

    return this.findOne(savedComment.id, userId);
  }

  async findOne(id: string, currentUserId?: string): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check if liked
    if (currentUserId) {
      const like = await this.likeRepository.findOne({
        where: { commentId: id, userId: currentUserId },
      });
      comment.isLiked = !!like;
    }

    return comment;
  }

  async findByPost(
    postId: string,
    query: CommentQueryDto,
    currentUserId?: string,
  ): Promise<CursorPaginatedResult<CommentWithReplies>> {
    const { limit = 20, sortBy, cursor } = query;

    // Get blocked users
    const blockedUsers = currentUserId
      ? await this.getBlockedUserIds(currentUserId)
      : [];

    // Build query for root comments only
    const queryBuilder = this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user')
      .where('comment.post_id = :postId', { postId })
      .andWhere('comment.parent_id IS NULL')
      .andWhere('comment.deleted_at IS NULL');

    // Exclude blocked users
    if (blockedUsers.length > 0) {
      queryBuilder.andWhere('comment.user_id NOT IN (:...blockedUsers)', {
        blockedUsers,
      });
    }

    // Cursor pagination
    if (cursor) {
      const cursorComment = await this.commentRepository.findOne({
        where: { id: cursor },
      });
      if (cursorComment) {
        queryBuilder.andWhere('comment.created_at < :cursorDate', {
          cursorDate: cursorComment.createdAt,
        });
      }
    }

    // Apply sorting
    switch (sortBy) {
      case CommentSortBy.OLDEST:
        queryBuilder.orderBy('comment.created_at', 'ASC');
        break;
      case CommentSortBy.POPULAR:
        queryBuilder.orderBy('comment.likes_count', 'DESC');
        break;
      case CommentSortBy.NEWEST:
      default:
        queryBuilder.orderBy('comment.created_at', 'DESC');
        break;
    }

    queryBuilder.take(limit + 1);

    const comments = await queryBuilder.getMany();
    const hasMore = comments.length > limit;
    if (hasMore) comments.pop();

    // Load first 3 replies for each comment
    const commentsWithReplies: CommentWithReplies[] = [];

    for (const comment of comments) {
      const replies = await this.commentRepository.find({
        where: { parentId: comment.id },
        relations: ['user'],
        order: { createdAt: 'ASC' },
        take: 3,
      });

      // Filter blocked users from replies
      const filteredReplies = blockedUsers.length > 0
        ? replies.filter((r) => !blockedUsers.includes(r.userId))
        : replies;

      commentsWithReplies.push({
        ...comment,
        replies: filteredReplies,
      });
    }

    // Mark liked comments
    if (currentUserId && commentsWithReplies.length > 0) {
      const allCommentIds = commentsWithReplies.flatMap((c) => [
        c.id,
        ...c.replies.map((r) => r.id),
      ]);

      const likes = await this.likeRepository.find({
        where: { userId: currentUserId, commentId: In(allCommentIds) },
      });
      const likedIds = new Set(likes.map((l) => l.commentId));

      commentsWithReplies.forEach((comment) => {
        comment.isLiked = likedIds.has(comment.id);
        comment.replies.forEach((reply) => {
          reply.isLiked = likedIds.has(reply.id);
        });
      });
    }

    return {
      data: commentsWithReplies,
      meta: {
        nextCursor:
          commentsWithReplies.length > 0
            ? commentsWithReplies[commentsWithReplies.length - 1].id
            : undefined,
        hasMore,
      },
    };
  }

  async findReplies(
    commentId: string,
    query: CommentQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<Comment>> {
    const { page = 1, limit = 20, sortBy } = query;

    // Verify parent comment exists
    const parentComment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!parentComment) {
      throw new NotFoundException('Comment not found');
    }

    const blockedUsers = currentUserId
      ? await this.getBlockedUserIds(currentUserId)
      : [];

    const queryBuilder = this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user')
      .where('comment.parent_id = :commentId', { commentId })
      .andWhere('comment.deleted_at IS NULL');

    if (blockedUsers.length > 0) {
      queryBuilder.andWhere('comment.user_id NOT IN (:...blockedUsers)', {
        blockedUsers,
      });
    }

    // Apply sorting
    switch (sortBy) {
      case CommentSortBy.OLDEST:
        queryBuilder.orderBy('comment.created_at', 'ASC');
        break;
      case CommentSortBy.POPULAR:
        queryBuilder.orderBy('comment.likes_count', 'DESC');
        break;
      case CommentSortBy.NEWEST:
      default:
        queryBuilder.orderBy('comment.created_at', 'DESC');
        break;
    }

    const [replies, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Mark liked
    if (currentUserId && replies.length > 0) {
      const replyIds = replies.map((r) => r.id);
      const likes = await this.likeRepository.find({
        where: { userId: currentUserId, commentId: In(replyIds) },
      });
      const likedIds = new Set(likes.map((l) => l.commentId));
      replies.forEach((reply) => {
        reply.isLiked = likedIds.has(reply.id);
      });
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: replies,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.findOne(id);

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    await this.commentRepository.update(id, {
      content: dto.content,
      isEdited: true,
    });

    return this.findOne(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const comment = await this.findOne(id);

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Soft delete the comment
    await this.commentRepository.softDelete(id);

    // Update parent's repliesCount if this was a reply
    if (comment.parentId) {
      await this.commentRepository.decrement(
        { id: comment.parentId },
        'repliesCount',
        1,
      );
    }

    // Update post's commentsCount
    await this.postRepository.decrement(
      { id: comment.postId },
      'commentsCount',
      1,
    );

    // Also decrement by the number of replies this comment had
    if (comment.repliesCount > 0) {
      await this.postRepository.decrement(
        { id: comment.postId },
        'commentsCount',
        comment.repliesCount,
      );
    }
  }

  async like(
    commentId: string,
    userId: string,
  ): Promise<{ isLiked: boolean; likesCount: number }> {
    // Verify comment exists
    await this.findOne(commentId);

    const existingLike = await this.likeRepository.findOne({
      where: { commentId, userId },
    });

    if (existingLike) {
      // Unlike
      await this.likeRepository.delete(existingLike.id);
      await this.commentRepository.decrement(
        { id: commentId },
        'likesCount',
        1,
      );
      const updated = await this.commentRepository.findOne({
        where: { id: commentId },
      });
      return { isLiked: false, likesCount: updated?.likesCount || 0 };
    }

    // Like
    const like = this.likeRepository.create({ commentId, userId });
    await this.likeRepository.save(like);
    await this.commentRepository.increment({ id: commentId }, 'likesCount', 1);
    const updated = await this.commentRepository.findOne({
      where: { id: commentId },
    });
    return { isLiked: true, likesCount: updated?.likesCount || 0 };
  }

  async getCommentCount(postId: string): Promise<number> {
    return this.commentRepository.count({
      where: { postId },
    });
  }

  // Private helpers

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
}
