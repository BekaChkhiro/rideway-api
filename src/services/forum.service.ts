import { prisma } from '../config/database';
import { AppError } from '../middleware/error-handler';
import { notificationsService } from './notifications.service';
import {
  CreateThreadInput,
  UpdateThreadInput,
  GetThreadsQuery,
  CreateReplyInput,
  UpdateReplyInput,
  GetRepliesQuery,
} from '../validators/forum';
import { Prisma } from '@prisma/client';

interface ThreadAuthor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  threadsCount: number;
}

interface ThreadResponse {
  id: string;
  title: string;
  content: string;
  viewsCount: number;
  repliesCount: number;
  likesCount: number;
  isPinned: boolean;
  isLocked: boolean;
  author: ThreadAuthor;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  isLiked: boolean;
  lastReplyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ReplyAuthor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface ReplyResponse {
  id: string;
  content: string;
  likesCount: number;
  author: ReplyAuthor;
  threadId: string;
  isLiked: boolean;
  createdAt: Date;
  updatedAt: Date;
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

export const forumService = {
  // ==================== CATEGORIES ====================

  async getCategories(): Promise<CategoryResponse[]> {
    const categories = await prisma.forumCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { threads: true },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.name.toLowerCase().replace(/\s+/g, '-'),
      description: cat.description,
      icon: cat.icon,
      order: cat.order,
      threadsCount: cat._count.threads,
    }));
  },

  // ==================== THREADS ====================

  async createThread(userId: string, data: CreateThreadInput): Promise<ThreadResponse> {
    // Verify category exists
    const category = await prisma.forumCategory.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new AppError(404, 'NOT_FOUND', 'კატეგორია ვერ მოიძებნა');
    }

    const thread = await prisma.forumThread.create({
      data: {
        title: data.title,
        content: data.content,
        userId,
        categoryId: data.categoryId,
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
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      id: thread.id,
      title: thread.title,
      content: thread.content,
      viewsCount: thread.viewCount,
      repliesCount: thread.replyCount,
      likesCount: thread.likeCount,
      isPinned: thread.isPinned,
      isLocked: thread.isLocked,
      author: {
        id: thread.user.id,
        username: thread.user.username,
        fullName: thread.user.fullName,
        avatarUrl: thread.user.avatarUrl,
      },
      category: {
        id: thread.category.id,
        name: thread.category.name,
        slug: thread.category.name.toLowerCase().replace(/\s+/g, '-'),
      },
      isLiked: false,
      lastReplyAt: null,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  },

  async getThreadById(threadId: string, currentUserId?: string): Promise<ThreadResponse> {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
            isActive: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!thread || !thread.user.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'თემა ვერ მოიძებნა');
    }

    // Check if liked
    let isLiked = false;
    if (currentUserId) {
      const like = await prisma.threadLike.findUnique({
        where: {
          userId_threadId: { userId: currentUserId, threadId },
        },
      });
      isLiked = !!like;
    }

    // Increment view count
    await prisma.forumThread.update({
      where: { id: threadId },
      data: { viewCount: { increment: 1 } },
    });

    return {
      id: thread.id,
      title: thread.title,
      content: thread.content,
      viewsCount: thread.viewCount + 1,
      repliesCount: thread.replyCount,
      likesCount: thread.likeCount,
      isPinned: thread.isPinned,
      isLocked: thread.isLocked,
      author: {
        id: thread.user.id,
        username: thread.user.username,
        fullName: thread.user.fullName,
        avatarUrl: thread.user.avatarUrl,
      },
      category: {
        id: thread.category.id,
        name: thread.category.name,
        slug: thread.category.name.toLowerCase().replace(/\s+/g, '-'),
      },
      isLiked,
      lastReplyAt: null,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  },

  async getThreads(
    query: GetThreadsQuery,
    currentUserId?: string
  ): Promise<PaginatedResult<ThreadResponse>> {
    const { page, limit, categoryId, sort } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ForumThreadWhereInput = {
      user: { isActive: true },
      ...(categoryId && { categoryId }),
    };

    // Determine sort order
    let orderBy: Prisma.ForumThreadOrderByWithRelationInput | Prisma.ForumThreadOrderByWithRelationInput[];
    switch (sort) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'popular':
        orderBy = [{ likeCount: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'most_replies':
        orderBy = [{ replyCount: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'latest':
      default:
        // Pinned first, then by date
        orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    }

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.forumThread.count({ where }),
    ]);

    // Get liked status
    let likedIds = new Set<string>();
    if (currentUserId) {
      const threadIds = threads.map((t) => t.id);
      const likes = await prisma.threadLike.findMany({
        where: {
          userId: currentUserId,
          threadId: { in: threadIds },
        },
        select: { threadId: true },
      });
      likedIds = new Set(likes.map((l) => l.threadId));
    }

    const items: ThreadResponse[] = threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      content: thread.content,
      viewsCount: thread.viewCount,
      repliesCount: thread.replyCount,
      likesCount: thread.likeCount,
      isPinned: thread.isPinned,
      isLocked: thread.isLocked,
      author: {
        id: thread.user.id,
        username: thread.user.username,
        fullName: thread.user.fullName,
        avatarUrl: thread.user.avatarUrl,
      },
      category: {
        id: thread.category.id,
        name: thread.category.name,
        slug: thread.category.name.toLowerCase().replace(/\s+/g, '-'),
      },
      isLiked: likedIds.has(thread.id),
      lastReplyAt: null,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async updateThread(
    threadId: string,
    userId: string,
    data: UpdateThreadInput
  ): Promise<ThreadResponse> {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new AppError(404, 'NOT_FOUND', 'თემა ვერ მოიძებნა');
    }

    if (thread.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ რედაქტირების უფლება');
    }

    if (thread.isLocked) {
      throw new AppError(403, 'FORBIDDEN', 'ეს თემა დაბლოკილია');
    }

    const updatedThread = await prisma.forumThread.update({
      where: { id: threadId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.content && { content: data.content }),
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
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      id: updatedThread.id,
      title: updatedThread.title,
      content: updatedThread.content,
      viewsCount: updatedThread.viewCount,
      repliesCount: updatedThread.replyCount,
      likesCount: updatedThread.likeCount,
      isPinned: updatedThread.isPinned,
      isLocked: updatedThread.isLocked,
      author: {
        id: updatedThread.user.id,
        username: updatedThread.user.username,
        fullName: updatedThread.user.fullName,
        avatarUrl: updatedThread.user.avatarUrl,
      },
      category: {
        id: updatedThread.category.id,
        name: updatedThread.category.name,
        slug: updatedThread.category.name.toLowerCase().replace(/\s+/g, '-'),
      },
      isLiked: false,
      lastReplyAt: null,
      createdAt: updatedThread.createdAt,
      updatedAt: updatedThread.updatedAt,
    };
  },

  async deleteThread(threadId: string, userId: string): Promise<void> {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new AppError(404, 'NOT_FOUND', 'თემა ვერ მოიძებნა');
    }

    if (thread.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ წაშლის უფლება');
    }

    await prisma.forumThread.delete({
      where: { id: threadId },
    });
  },

  async toggleThreadLike(
    threadId: string,
    userId: string
  ): Promise<{ isLiked: boolean; likesCount: number }> {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true, userId: true },
    });

    if (!thread) {
      throw new AppError(404, 'NOT_FOUND', 'თემა ვერ მოიძებნა');
    }

    const existingLike = await prisma.threadLike.findUnique({
      where: {
        userId_threadId: { userId, threadId },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.$transaction([
        prisma.threadLike.delete({
          where: { id: existingLike.id },
        }),
        prisma.forumThread.update({
          where: { id: threadId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);

      const count = await prisma.threadLike.count({
        where: { threadId },
      });

      return { isLiked: false, likesCount: count };
    } else {
      // Like
      await prisma.$transaction([
        prisma.threadLike.create({
          data: { userId, threadId },
        }),
        prisma.forumThread.update({
          where: { id: threadId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);

      const count = await prisma.threadLike.count({
        where: { threadId },
      });

      return { isLiked: true, likesCount: count };
    }
  },

  // ==================== REPLIES ====================

  async createReply(
    threadId: string,
    userId: string,
    data: CreateReplyInput
  ): Promise<ReplyResponse> {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true, userId: true, isLocked: true, title: true },
    });

    if (!thread) {
      throw new AppError(404, 'NOT_FOUND', 'თემა ვერ მოიძებნა');
    }

    if (thread.isLocked) {
      throw new AppError(403, 'FORBIDDEN', 'ეს თემა დაბლოკილია');
    }

    const reply = await prisma.$transaction(async (tx) => {
      const newReply = await tx.threadReply.create({
        data: {
          content: data.content,
          userId,
          threadId,
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

      // Update reply count
      await tx.forumThread.update({
        where: { id: threadId },
        data: { replyCount: { increment: 1 } },
      });

      return newReply;
    });

    // Send notification to thread author (if not self)
    if (thread.userId !== userId) {
      await notificationsService.createNotification({
        userId: thread.userId,
        type: 'THREAD_REPLY',
        title: 'ახალი პასუხი',
        body: `მომხმარებელმა უპასუხა თქვენს თემას "${thread.title.substring(0, 50)}..."`,
        data: { threadId, replyId: reply.id },
      });
    }

    return {
      id: reply.id,
      content: reply.content,
      likesCount: reply.likeCount,
      author: {
        id: reply.user.id,
        username: reply.user.username,
        fullName: reply.user.fullName,
        avatarUrl: reply.user.avatarUrl,
      },
      threadId,
      isLiked: false,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
    };
  },

  async getReplies(
    threadId: string,
    query: GetRepliesQuery,
    currentUserId?: string
  ): Promise<PaginatedResult<ReplyResponse>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    // Check thread exists
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true },
    });

    if (!thread) {
      throw new AppError(404, 'NOT_FOUND', 'თემა ვერ მოიძებნა');
    }

    const where = {
      threadId,
      user: { isActive: true },
    };

    const [replies, total] = await Promise.all([
      prisma.threadReply.findMany({
        where,
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
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.threadReply.count({ where }),
    ]);

    // Get liked status
    let likedIds = new Set<string>();
    if (currentUserId) {
      const replyIds = replies.map((r) => r.id);
      const likes = await prisma.replyLike.findMany({
        where: {
          userId: currentUserId,
          replyId: { in: replyIds },
        },
        select: { replyId: true },
      });
      likedIds = new Set(likes.map((l) => l.replyId));
    }

    const items: ReplyResponse[] = replies.map((reply) => ({
      id: reply.id,
      content: reply.content,
      likesCount: reply.likeCount,
      author: {
        id: reply.user.id,
        username: reply.user.username,
        fullName: reply.user.fullName,
        avatarUrl: reply.user.avatarUrl,
      },
      threadId,
      isLiked: likedIds.has(reply.id),
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async updateReply(
    replyId: string,
    userId: string,
    data: UpdateReplyInput
  ): Promise<ReplyResponse> {
    const reply = await prisma.threadReply.findUnique({
      where: { id: replyId },
      include: {
        thread: {
          select: { isLocked: true },
        },
      },
    });

    if (!reply) {
      throw new AppError(404, 'NOT_FOUND', 'პასუხი ვერ მოიძებნა');
    }

    if (reply.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ რედაქტირების უფლება');
    }

    if (reply.thread.isLocked) {
      throw new AppError(403, 'FORBIDDEN', 'ეს თემა დაბლოკილია');
    }

    const updatedReply = await prisma.threadReply.update({
      where: { id: replyId },
      data: { content: data.content },
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
      id: updatedReply.id,
      content: updatedReply.content,
      likesCount: updatedReply.likeCount,
      author: {
        id: updatedReply.user.id,
        username: updatedReply.user.username,
        fullName: updatedReply.user.fullName,
        avatarUrl: updatedReply.user.avatarUrl,
      },
      threadId: reply.threadId,
      isLiked: false,
      createdAt: updatedReply.createdAt,
      updatedAt: updatedReply.updatedAt,
    };
  },

  async deleteReply(replyId: string, userId: string): Promise<void> {
    const reply = await prisma.threadReply.findUnique({
      where: { id: replyId },
      include: {
        thread: {
          select: { id: true },
        },
      },
    });

    if (!reply) {
      throw new AppError(404, 'NOT_FOUND', 'პასუხი ვერ მოიძებნა');
    }

    if (reply.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ წაშლის უფლება');
    }

    await prisma.$transaction([
      prisma.threadReply.delete({
        where: { id: replyId },
      }),
      prisma.forumThread.update({
        where: { id: reply.thread.id },
        data: { replyCount: { decrement: 1 } },
      }),
    ]);
  },

  async toggleReplyLike(
    replyId: string,
    userId: string
  ): Promise<{ isLiked: boolean; likesCount: number }> {
    const reply = await prisma.threadReply.findUnique({
      where: { id: replyId },
      select: { id: true },
    });

    if (!reply) {
      throw new AppError(404, 'NOT_FOUND', 'პასუხი ვერ მოიძებნა');
    }

    const existingLike = await prisma.replyLike.findUnique({
      where: {
        userId_replyId: { userId, replyId },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.$transaction([
        prisma.replyLike.delete({
          where: { id: existingLike.id },
        }),
        prisma.threadReply.update({
          where: { id: replyId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);

      const count = await prisma.replyLike.count({
        where: { replyId },
      });

      return { isLiked: false, likesCount: count };
    } else {
      // Like
      await prisma.$transaction([
        prisma.replyLike.create({
          data: { userId, replyId },
        }),
        prisma.threadReply.update({
          where: { id: replyId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);

      const count = await prisma.replyLike.count({
        where: { replyId },
      });

      return { isLiked: true, likesCount: count };
    }
  },
};
