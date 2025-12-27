import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RedisService } from '@redis/redis.service.js';
import { ForumThread } from './entities/forum-thread.entity.js';
import { ThreadReply } from './entities/thread-reply.entity.js';
import { ThreadLike } from './entities/thread-like.entity.js';
import { ThreadSubscription } from './entities/thread-subscription.entity.js';
import { ReplyLike } from './entities/reply-like.entity.js';
import { ForumCategoriesService } from './forum-categories.service.js';
import { CreateThreadDto } from './dto/create-thread.dto.js';
import { UpdateThreadDto } from './dto/update-thread.dto.js';
import { ThreadQueryDto, ThreadSortBy } from './dto/thread-query.dto.js';
import { CreateReplyDto } from './dto/create-reply.dto.js';
import { UpdateReplyDto } from './dto/update-reply.dto.js';

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

@Injectable()
export class ForumThreadsService {
  private readonly VIEWS_CACHE_KEY = 'forum:thread:views:';
  private readonly VIEWS_SYNC_INTERVAL = 60000;

  constructor(
    @InjectRepository(ForumThread)
    private readonly threadRepository: Repository<ForumThread>,
    @InjectRepository(ThreadReply)
    private readonly replyRepository: Repository<ThreadReply>,
    @InjectRepository(ThreadLike)
    private readonly likeRepository: Repository<ThreadLike>,
    @InjectRepository(ThreadSubscription)
    private readonly subscriptionRepository: Repository<ThreadSubscription>,
    @InjectRepository(ReplyLike)
    private readonly replyLikeRepository: Repository<ReplyLike>,
    private readonly categoriesService: ForumCategoriesService,
    private readonly redisService: RedisService,
  ) {
    this.startViewsSync();
  }

  // Thread methods
  async create(userId: string, dto: CreateThreadDto): Promise<ForumThread> {
    // Verify category exists
    await this.categoriesService.findOne(dto.categoryId);

    const thread = this.threadRepository.create({
      userId,
      categoryId: dto.categoryId,
      title: dto.title,
      content: dto.content,
    });

    const savedThread = await this.threadRepository.save(thread);

    // Increment category thread count
    await this.categoriesService.incrementThreadsCount(dto.categoryId);

    // Auto-subscribe creator
    await this.subscribe(savedThread.id, userId);

    return this.findOne(savedThread.id, userId);
  }

  async findAll(
    query: ThreadQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<ForumThread>> {
    const { page = 1, limit = 20, categoryId, sortBy } = query;

    const queryBuilder = this.threadRepository
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.user', 'user')
      .leftJoinAndSelect('thread.category', 'category')
      .leftJoinAndSelect('thread.lastReplyUser', 'lastReplyUser')
      .where('thread.deleted_at IS NULL');

    if (categoryId) {
      queryBuilder.andWhere('thread.category_id = :categoryId', { categoryId });
    }

    // Pinned threads first, then apply sort
    queryBuilder.orderBy('thread.is_pinned', 'DESC');

    switch (sortBy) {
      case ThreadSortBy.ACTIVE:
        queryBuilder.addOrderBy(
          'COALESCE(thread.last_reply_at, thread.created_at)',
          'DESC',
        );
        break;
      case ThreadSortBy.POPULAR:
        queryBuilder.addOrderBy('thread.replies_count', 'DESC');
        break;
      case ThreadSortBy.LATEST:
      default:
        queryBuilder.addOrderBy('thread.created_at', 'DESC');
        break;
    }

    const [threads, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Mark liked and subscribed
    if (currentUserId && threads.length > 0) {
      await this.markThreadFlags(threads, currentUserId);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: threads,
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

  async findOne(id: string, currentUserId?: string): Promise<ForumThread> {
    const thread = await this.threadRepository.findOne({
      where: { id },
      relations: ['user', 'category', 'lastReplyUser'],
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (currentUserId) {
      const [like, subscription] = await Promise.all([
        this.likeRepository.findOne({
          where: { threadId: id, userId: currentUserId },
        }),
        this.subscriptionRepository.findOne({
          where: { threadId: id, userId: currentUserId },
        }),
      ]);
      thread.isLiked = !!like;
      thread.isSubscribed = !!subscription;
    }

    return thread;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateThreadDto,
  ): Promise<ForumThread> {
    const thread = await this.findOne(id);

    if (thread.userId !== userId) {
      throw new ForbiddenException('You can only edit your own threads');
    }

    await this.threadRepository.update(id, dto);

    return this.findOne(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const thread = await this.findOne(id);

    if (thread.userId !== userId) {
      throw new ForbiddenException('You can only delete your own threads');
    }

    await this.threadRepository.softDelete(id);

    // Decrement category thread count
    await this.categoriesService.decrementThreadsCount(thread.categoryId);
  }

  async incrementViews(id: string): Promise<void> {
    await this.redisService.getClient().incr(`${this.VIEWS_CACHE_KEY}${id}`);
  }

  async like(
    threadId: string,
    userId: string,
  ): Promise<{ isLiked: boolean; likesCount: number }> {
    await this.findOne(threadId);

    const existingLike = await this.likeRepository.findOne({
      where: { threadId, userId },
    });

    if (existingLike) {
      await this.likeRepository.delete(existingLike.id);
      await this.threadRepository.decrement({ id: threadId }, 'likesCount', 1);
      const updated = await this.threadRepository.findOne({
        where: { id: threadId },
      });
      return { isLiked: false, likesCount: updated?.likesCount || 0 };
    }

    const like = this.likeRepository.create({ threadId, userId });
    await this.likeRepository.save(like);
    await this.threadRepository.increment({ id: threadId }, 'likesCount', 1);
    const updated = await this.threadRepository.findOne({
      where: { id: threadId },
    });
    return { isLiked: true, likesCount: updated?.likesCount || 0 };
  }

  async pin(id: string): Promise<ForumThread> {
    const thread = await this.findOne(id);
    await this.threadRepository.update(id, { isPinned: !thread.isPinned });
    return this.findOne(id);
  }

  async lock(id: string): Promise<ForumThread> {
    const thread = await this.findOne(id);
    await this.threadRepository.update(id, { isLocked: !thread.isLocked });
    return this.findOne(id);
  }

  async subscribe(
    threadId: string,
    userId: string,
  ): Promise<{ isSubscribed: boolean }> {
    await this.findOne(threadId);

    const existing = await this.subscriptionRepository.findOne({
      where: { threadId, userId },
    });

    if (existing) {
      await this.subscriptionRepository.delete(existing.id);
      return { isSubscribed: false };
    }

    const subscription = this.subscriptionRepository.create({
      threadId,
      userId,
    });
    await this.subscriptionRepository.save(subscription);
    return { isSubscribed: true };
  }

  async getSubscribers(threadId: string): Promise<string[]> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { threadId },
      select: ['userId'],
    });

    return subscriptions.map((s) => s.userId);
  }

  // Reply methods
  async createReply(
    threadId: string,
    userId: string,
    dto: CreateReplyDto,
  ): Promise<ThreadReply> {
    const thread = await this.findOne(threadId);

    if (thread.isLocked) {
      throw new BadRequestException('This thread is locked');
    }

    const reply = this.replyRepository.create({
      threadId,
      userId,
      parentId: dto.parentId,
      content: dto.content,
    });

    const savedReply = await this.replyRepository.save(reply);

    // Update thread
    await this.threadRepository.update(threadId, {
      repliesCount: () => 'replies_count + 1',
      lastReplyAt: new Date(),
      lastReplyUserId: userId,
    });

    return this.findReply(savedReply.id, userId);
  }

  async findReplies(
    threadId: string,
    page: number = 1,
    limit: number = 20,
    currentUserId?: string,
  ): Promise<PaginatedResult<ThreadReply>> {
    const [replies, total] = await this.replyRepository.findAndCount({
      where: { threadId, parentId: undefined },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Mark liked
    if (currentUserId && replies.length > 0) {
      const replyIds = replies.map((r) => r.id);
      const likes = await this.replyLikeRepository.find({
        where: { userId: currentUserId, replyId: In(replyIds) },
      });
      const likedIds = new Set(likes.map((l) => l.replyId));
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

  async findReply(id: string, currentUserId?: string): Promise<ThreadReply> {
    const reply = await this.replyRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    if (currentUserId) {
      const like = await this.replyLikeRepository.findOne({
        where: { replyId: id, userId: currentUserId },
      });
      reply.isLiked = !!like;
    }

    return reply;
  }

  async updateReply(
    id: string,
    userId: string,
    dto: UpdateReplyDto,
  ): Promise<ThreadReply> {
    const reply = await this.findReply(id);

    if (reply.userId !== userId) {
      throw new ForbiddenException('You can only edit your own replies');
    }

    await this.replyRepository.update(id, {
      content: dto.content,
      isEdited: true,
    });

    return this.findReply(id, userId);
  }

  async deleteReply(id: string, userId: string): Promise<void> {
    const reply = await this.findReply(id);

    if (reply.userId !== userId) {
      throw new ForbiddenException('You can only delete your own replies');
    }

    await this.replyRepository.softDelete(id);

    // Decrement thread reply count
    await this.threadRepository.decrement(
      { id: reply.threadId },
      'repliesCount',
      1,
    );
  }

  async likeReply(
    replyId: string,
    userId: string,
  ): Promise<{ isLiked: boolean; likesCount: number }> {
    await this.findReply(replyId);

    const existingLike = await this.replyLikeRepository.findOne({
      where: { replyId, userId },
    });

    if (existingLike) {
      await this.replyLikeRepository.delete(existingLike.id);
      await this.replyRepository.decrement({ id: replyId }, 'likesCount', 1);
      const updated = await this.replyRepository.findOne({
        where: { id: replyId },
      });
      return { isLiked: false, likesCount: updated?.likesCount || 0 };
    }

    const like = this.replyLikeRepository.create({ replyId, userId });
    await this.replyLikeRepository.save(like);
    await this.replyRepository.increment({ id: replyId }, 'likesCount', 1);
    const updated = await this.replyRepository.findOne({
      where: { id: replyId },
    });
    return { isLiked: true, likesCount: updated?.likesCount || 0 };
  }

  // Private helpers
  private async markThreadFlags(
    threads: ForumThread[],
    userId: string,
  ): Promise<void> {
    const threadIds = threads.map((t) => t.id);

    const [likes, subscriptions] = await Promise.all([
      this.likeRepository.find({
        where: { userId, threadId: In(threadIds) },
      }),
      this.subscriptionRepository.find({
        where: { userId, threadId: In(threadIds) },
      }),
    ]);

    const likedIds = new Set(likes.map((l) => l.threadId));
    const subscribedIds = new Set(subscriptions.map((s) => s.threadId));

    threads.forEach((thread) => {
      thread.isLiked = likedIds.has(thread.id);
      thread.isSubscribed = subscribedIds.has(thread.id);
    });
  }

  private startViewsSync(): void {
    setInterval(async () => {
      try {
        await this.syncViewCounts();
      } catch (error) {
        console.error('Failed to sync forum view counts', error);
      }
    }, this.VIEWS_SYNC_INTERVAL);
  }

  private async syncViewCounts(): Promise<void> {
    if (!this.redisService) return;
    const keys = await this.redisService.keys(`${this.VIEWS_CACHE_KEY}*`);

    if (keys.length === 0) return;

    const client = this.redisService.getClient();
    for (const key of keys) {
      const threadId = key.replace(this.VIEWS_CACHE_KEY, '');
      const views = await client.getdel(key);

      if (views) {
        await this.threadRepository.increment(
          { id: threadId },
          'viewsCount',
          parseInt(views, 10),
        );
      }
    }
  }
}
