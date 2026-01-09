import { prisma } from '../config/database';
import { Role } from '@prisma/client';
import { AppError } from '../middleware/error-handler';
import {
  AdminGetUsersInput,
  AdminGetContentInput,
  BanUserInput,
} from '../validators/admin';

interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  isVerified: boolean;
  isBanned: boolean;
  bannedAt: Date | null;
  bannedUntil: Date | null;
  banReason: string | null;
  postsCount: number;
  followersCount: number;
  createdAt: Date;
  lastLoginAt: Date | null;
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

interface DashboardStats {
  users: {
    total: number;
    newToday: number;
    newThisWeek: number;
    banned: number;
  };
  content: {
    posts: number;
    comments: number;
    listings: number;
    forumThreads: number;
    services: number;
  };
  activity: {
    postsToday: number;
    messagesToday: number;
    newListingsToday: number;
  };
}

const userSelect = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  phone: true,
  avatarUrl: true,
  role: true,
  isVerified: true,
  isBanned: true,
  bannedAt: true,
  bannedUntil: true,
  banReason: true,
  createdAt: true,
  lastLoginAt: true,
  _count: {
    select: {
      posts: true,
      followers: true,
    },
  },
} as const;

function mapToAdminUser(user: {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  isVerified: boolean;
  isBanned: boolean;
  bannedAt: Date | null;
  bannedUntil: Date | null;
  banReason: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  _count: { posts: number; followers: number };
}): AdminUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isVerified: user.isVerified,
    isBanned: user.isBanned,
    bannedAt: user.bannedAt,
    bannedUntil: user.bannedUntil,
    banReason: user.banReason,
    postsCount: user._count.posts,
    followersCount: user._count.followers,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export const adminService = {
  // ==================== USERS ====================

  async getUsers(
    params: AdminGetUsersInput
  ): Promise<PaginatedResult<AdminUser>> {
    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (params.q) {
      where.OR = [
        { username: { contains: params.q, mode: 'insensitive' } },
        { fullName: { contains: params.q, mode: 'insensitive' } },
        { email: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    if (params.role) {
      where.role = params.role;
    }

    if (params.isBanned === 'true') {
      where.isBanned = true;
    } else if (params.isBanned === 'false') {
      where.isBanned = false;
    }

    if (params.isVerified === 'true') {
      where.isVerified = true;
    } else if (params.isVerified === 'false') {
      where.isVerified = false;
    }

    const orderBy: Record<string, string> = {};
    orderBy[params.sortBy || 'createdAt'] = params.sortOrder || 'desc';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: users.map(mapToAdminUser),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getUserById(userId: string): Promise<AdminUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    return mapToAdminUser(user);
  },

  async changeUserRole(
    adminId: string,
    userId: string,
    newRole: Role
  ): Promise<AdminUser> {
    if (adminId === userId) {
      throw new AppError(400, 'BAD_REQUEST', 'საკუთარ როლს ვერ შეცვლით');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN' && (user.role === 'ADMIN' || newRole === 'ADMIN')) {
      throw new AppError(403, 'FORBIDDEN', 'ადმინის როლის შეცვლის უფლება არ გაქვთ');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: userSelect,
    });

    return mapToAdminUser(updated);
  },

  async banUser(
    adminId: string,
    userId: string,
    data: BanUserInput
  ): Promise<AdminUser> {
    if (adminId === userId) {
      throw new AppError(400, 'BAD_REQUEST', 'საკუთარ თავს ვერ დაბლოკავთ');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isBanned: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    if (user.role === 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'ადმინის დაბლოკვა შეუძლებელია');
    }

    if (user.isBanned) {
      throw new AppError(400, 'ALREADY_BANNED', 'მომხმარებელი უკვე დაბლოკილია');
    }

    const bannedUntil = data.duration
      ? new Date(Date.now() + data.duration * 60 * 60 * 1000)
      : null;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedUntil,
        banReason: data.reason,
      },
      select: userSelect,
    });

    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return mapToAdminUser(updated);
  },

  async unbanUser(adminId: string, userId: string): Promise<AdminUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    if (!user.isBanned) {
      throw new AppError(400, 'NOT_BANNED', 'მომხმარებელი არ არის დაბლოკილი');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
      },
      select: userSelect,
    });

    return mapToAdminUser(updated);
  },

  async deleteUser(adminId: string, userId: string): Promise<void> {
    if (adminId === userId) {
      throw new AppError(400, 'BAD_REQUEST', 'საკუთარ თავს ვერ წაშლით');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    if (user.role === 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'ადმინის წაშლა შეუძლებელია');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  },

  // ==================== CONTENT MODERATION ====================

  async getPosts(params: AdminGetContentInput): Promise<PaginatedResult<unknown>> {
    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '20');
    const skip = (page - 1) * limit;

    const where = { isDeleted: false };

    const orderBy: Record<string, string> = {};
    orderBy[params.sortBy || 'createdAt'] = params.sortOrder || 'desc';

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          content: true,
          createdAt: true,
          likeCount: true,
          commentCount: true,
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          images: {
            select: {
              id: true,
              url: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.post.count({ where }),
    ]);

    return {
      items: posts.map((post) => ({
        id: post.id,
        content: post.content,
        author: post.user,
        images: post.images,
        likesCount: post.likeCount,
        commentsCount: post.commentCount,
        createdAt: post.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async deletePost(postId: string, _reason: string): Promise<void> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, isDeleted: true },
    });

    if (!post) {
      throw new AppError(404, 'NOT_FOUND', 'პოსტი ვერ მოიძებნა');
    }

    if (post.isDeleted) {
      throw new AppError(400, 'ALREADY_DELETED', 'პოსტი უკვე წაშლილია');
    }

    await prisma.post.update({
      where: { id: postId },
      data: { isDeleted: true },
    });
  },

  async getComments(params: AdminGetContentInput): Promise<PaginatedResult<unknown>> {
    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '20');
    const skip = (page - 1) * limit;

    const where = { isDeleted: false };

    const orderBy: Record<string, string> = {};
    orderBy[params.sortBy || 'createdAt'] = params.sortOrder || 'desc';

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        select: {
          id: true,
          content: true,
          createdAt: true,
          postId: true,
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          post: {
            select: {
              id: true,
              content: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      items: comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        author: comment.user,
        post: comment.post,
        createdAt: comment.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async deleteComment(commentId: string, _reason: string): Promise<void> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, isDeleted: true },
    });

    if (!comment) {
      throw new AppError(404, 'NOT_FOUND', 'კომენტარი ვერ მოიძებნა');
    }

    if (comment.isDeleted) {
      throw new AppError(400, 'ALREADY_DELETED', 'კომენტარი უკვე წაშლილია');
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: { isDeleted: true },
    });
  },

  async getListings(params: AdminGetContentInput): Promise<PaginatedResult<unknown>> {
    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '20');
    const skip = (page - 1) * limit;

    const orderBy: Record<string, string> = {};
    orderBy[params.sortBy || 'createdAt'] = params.sortOrder || 'desc';

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        select: {
          id: true,
          title: true,
          price: true,
          status: true,
          createdAt: true,
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
          images: {
            select: {
              id: true,
              url: true,
            },
            take: 1,
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.listing.count(),
    ]);

    return {
      items: listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        status: listing.status,
        seller: listing.user,
        category: listing.category,
        image: listing.images[0] || null,
        createdAt: listing.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async deleteListing(listingId: string, _reason: string): Promise<void> {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });

    if (!listing) {
      throw new AppError(404, 'NOT_FOUND', 'განცხადება ვერ მოიძებნა');
    }

    await prisma.listing.delete({
      where: { id: listingId },
    });
  },

  async getForumThreads(params: AdminGetContentInput): Promise<PaginatedResult<unknown>> {
    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '20');
    const skip = (page - 1) * limit;

    const orderBy: Record<string, string> = {};
    orderBy[params.sortBy || 'createdAt'] = params.sortOrder || 'desc';

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        select: {
          id: true,
          title: true,
          content: true,
          isPinned: true,
          isLocked: true,
          replyCount: true,
          createdAt: true,
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
      prisma.forumThread.count(),
    ]);

    return {
      items: threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        content: thread.content,
        author: thread.user,
        category: thread.category,
        repliesCount: thread.replyCount,
        isPinned: thread.isPinned,
        isLocked: thread.isLocked,
        createdAt: thread.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async deleteForumThread(threadId: string, _reason: string): Promise<void> {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true },
    });

    if (!thread) {
      throw new AppError(404, 'NOT_FOUND', 'თემა ვერ მოიძებნა');
    }

    await prisma.forumThread.delete({
      where: { id: threadId },
    });
  },

  async toggleThreadPin(threadId: string): Promise<{ isPinned: boolean }> {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true, isPinned: true },
    });

    if (!thread) {
      throw new AppError(404, 'NOT_FOUND', 'თემა ვერ მოიძებნა');
    }

    const updated = await prisma.forumThread.update({
      where: { id: threadId },
      data: { isPinned: !thread.isPinned },
      select: { isPinned: true },
    });

    return updated;
  },

  async toggleThreadLock(threadId: string): Promise<{ isLocked: boolean }> {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true, isLocked: true },
    });

    if (!thread) {
      throw new AppError(404, 'NOT_FOUND', 'თემა ვერ მოიძებნა');
    }

    const updated = await prisma.forumThread.update({
      where: { id: threadId },
      data: { isLocked: !thread.isLocked },
      select: { isLocked: true },
    });

    return updated;
  },

  // ==================== DASHBOARD ====================

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      bannedUsers,
      totalPosts,
      totalComments,
      totalListings,
      totalForumThreads,
      totalServices,
      postsToday,
      messagesToday,
      newListingsToday,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({
        where: { isActive: true, createdAt: { gte: todayStart } },
      }),
      prisma.user.count({
        where: { isActive: true, createdAt: { gte: weekStart } },
      }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.post.count({ where: { isDeleted: false } }),
      prisma.comment.count({ where: { isDeleted: false } }),
      prisma.listing.count(),
      prisma.forumThread.count(),
      prisma.service.count(),
      prisma.post.count({
        where: { isDeleted: false, createdAt: { gte: todayStart } },
      }),
      prisma.message.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.listing.count({
        where: { createdAt: { gte: todayStart } },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        banned: bannedUsers,
      },
      content: {
        posts: totalPosts,
        comments: totalComments,
        listings: totalListings,
        forumThreads: totalForumThreads,
        services: totalServices,
      },
      activity: {
        postsToday,
        messagesToday,
        newListingsToday,
      },
    };
  },
};
