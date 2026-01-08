import { prisma } from '../config/database';
import { Gender } from '@prisma/client';
import { AppError } from '../middleware/error-handler';
import { UpdateProfileInput } from '../validators/users';

interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  location: string | null;
  website: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
  createdAt: Date;
}

interface UserListItem {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  isFollowing: boolean;
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

export const usersService = {
  async getProfileByUsername(
    username: string,
    currentUserId?: string
  ): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        coverUrl: true,
        location: true,
        website: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: { where: { isDeleted: false } },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    // Check relationship status if current user is authenticated
    let isFollowing = false;
    let isBlocked = false;
    let isBlockedBy = false;

    if (currentUserId && currentUserId !== user.id) {
      const [followRecord, blockRecord, blockedByRecord] = await Promise.all([
        prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: user.id,
            },
          },
        }),
        prisma.block.findUnique({
          where: {
            blockerId_blockedId: {
              blockerId: currentUserId,
              blockedId: user.id,
            },
          },
        }),
        prisma.block.findUnique({
          where: {
            blockerId_blockedId: {
              blockerId: user.id,
              blockedId: currentUserId,
            },
          },
        }),
      ]);

      isFollowing = !!followRecord;
      isBlocked = !!blockRecord;
      isBlockedBy = !!blockedByRecord;
    }

    // If blocked by this user, don't show profile
    if (isBlockedBy) {
      throw new AppError(403, 'BLOCKED', 'პროფილი მიუწვდომელია');
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverUrl: user.coverUrl,
      location: user.location,
      website: user.website,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      postsCount: user._count.posts,
      isFollowing,
      isBlocked,
      isBlockedBy: false, // We throw error above, so this is always false here
      createdAt: user.createdAt,
    };
  },

  async updateProfile(
    userId: string,
    data: UpdateProfileInput
  ): Promise<UserProfile> {
    // Check if username is taken (if changing)
    if (data.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new AppError(409, 'CONFLICT', 'ეს username უკვე დაკავებულია');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.username && { username: data.username }),
        ...(data.fullName && { fullName: data.fullName }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.gender !== undefined && { gender: data.gender as Gender }),
        ...(data.dateOfBirth !== undefined && {
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        }),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        coverUrl: true,
        location: true,
        website: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: { where: { isDeleted: false } },
          },
        },
      },
    });

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverUrl: user.coverUrl,
      location: user.location,
      website: user.website,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      postsCount: user._count.posts,
      isFollowing: false, // Own profile
      isBlocked: false,
      isBlockedBy: false,
      createdAt: user.createdAt,
    };
  },

  async searchUsers(
    query: string,
    currentUserId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<UserListItem>> {
    const skip = (page - 1) * limit;

    // Get blocked user IDs (both directions)
    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: currentUserId }, { blockedId: currentUserId }],
      },
      select: { blockerId: true, blockedId: true },
    });

    const blockedIds = new Set<string>();
    blocks.forEach((b) => {
      blockedIds.add(b.blockerId);
      blockedIds.add(b.blockedId);
    });
    blockedIds.delete(currentUserId);

    const where = {
      isActive: true,
      id: { notIn: Array.from(blockedIds) },
      OR: [
        { username: { contains: query, mode: 'insensitive' as const } },
        { fullName: { contains: query, mode: 'insensitive' as const } },
      ],
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
          bio: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    // Get following status for all users
    const followingRecords = await prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        followingId: { in: users.map((u) => u.id) },
      },
      select: { followingId: true },
    });

    const followingIds = new Set(followingRecords.map((f) => f.followingId));

    const items: UserListItem[] = users.map((user) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isFollowing: followingIds.has(user.id),
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

  async getFollowers(
    userId: string,
    currentUserId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<UserListItem>> {
    const skip = (page - 1) * limit;

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    // Check if blocked
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: currentUserId },
          { blockerId: currentUserId, blockedId: userId },
        ],
      },
    });

    if (isBlocked) {
      throw new AppError(403, 'BLOCKED', 'პროფილი მიუწვდომელია');
    }

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              bio: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follow.count({ where: { followingId: userId } }),
    ]);

    // Get following status
    const followerIds = follows.map((f) => f.follower.id);
    const followingRecords = await prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        followingId: { in: followerIds },
      },
      select: { followingId: true },
    });

    const followingIds = new Set(followingRecords.map((f) => f.followingId));

    const items: UserListItem[] = follows.map((f) => ({
      id: f.follower.id,
      username: f.follower.username,
      fullName: f.follower.fullName,
      avatarUrl: f.follower.avatarUrl,
      bio: f.follower.bio,
      isFollowing: followingIds.has(f.follower.id),
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

  async getFollowing(
    userId: string,
    currentUserId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<UserListItem>> {
    const skip = (page - 1) * limit;

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    // Check if blocked
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: currentUserId },
          { blockerId: currentUserId, blockedId: userId },
        ],
      },
    });

    if (isBlocked) {
      throw new AppError(403, 'BLOCKED', 'პროფილი მიუწვდომელია');
    }

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              bio: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);

    // Get following status
    const followingUserIds = follows.map((f) => f.following.id);
    const followingRecords = await prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        followingId: { in: followingUserIds },
      },
      select: { followingId: true },
    });

    const followingIds = new Set(followingRecords.map((f) => f.followingId));

    const items: UserListItem[] = follows.map((f) => ({
      id: f.following.id,
      username: f.following.username,
      fullName: f.following.fullName,
      avatarUrl: f.following.avatarUrl,
      bio: f.following.bio,
      isFollowing: followingIds.has(f.following.id),
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

  async follow(currentUserId: string, targetUserId: string): Promise<void> {
    if (currentUserId === targetUserId) {
      throw new AppError(400, 'BAD_REQUEST', 'საკუთარ თავს ვერ გამოიწერთ');
    }

    // Check if target exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    // Check if blocked
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: targetUserId, blockedId: currentUserId },
          { blockerId: currentUserId, blockedId: targetUserId },
        ],
      },
    });

    if (block) {
      throw new AppError(403, 'BLOCKED', 'გამოწერა შეუძლებელია');
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      throw new AppError(400, 'ALREADY_FOLLOWING', 'უკვე გამოწერილი გაქვთ');
    }

    await prisma.follow.create({
      data: {
        followerId: currentUserId,
        followingId: targetUserId,
      },
    });

    // TODO: Create notification
  },

  async unfollow(currentUserId: string, targetUserId: string): Promise<void> {
    const result = await prisma.follow.deleteMany({
      where: {
        followerId: currentUserId,
        followingId: targetUserId,
      },
    });

    if (result.count === 0) {
      throw new AppError(400, 'NOT_FOLLOWING', 'არ გაქვთ გამოწერილი');
    }
  },

  async block(currentUserId: string, targetUserId: string): Promise<void> {
    if (currentUserId === targetUserId) {
      throw new AppError(400, 'BAD_REQUEST', 'საკუთარ თავს ვერ დაბლოკავთ');
    }

    // Check if target exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    // Check if already blocked
    const existingBlock = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: currentUserId,
          blockedId: targetUserId,
        },
      },
    });

    if (existingBlock) {
      throw new AppError(400, 'ALREADY_BLOCKED', 'უკვე დაბლოკილია');
    }

    // Block and remove follows in both directions
    await prisma.$transaction([
      prisma.block.create({
        data: {
          blockerId: currentUserId,
          blockedId: targetUserId,
        },
      }),
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: currentUserId, followingId: targetUserId },
            { followerId: targetUserId, followingId: currentUserId },
          ],
        },
      }),
    ]);
  },

  async unblock(currentUserId: string, targetUserId: string): Promise<void> {
    const result = await prisma.block.deleteMany({
      where: {
        blockerId: currentUserId,
        blockedId: targetUserId,
      },
    });

    if (result.count === 0) {
      throw new AppError(400, 'NOT_BLOCKED', 'არ გაქვთ დაბლოკილი');
    }
  },
};
