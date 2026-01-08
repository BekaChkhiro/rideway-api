import { prisma } from '../config/database';
import { AppError } from '../middleware/error-handler';
import { uploadFiles, deleteFiles, extractKeyFromUrl } from './media.service';
import { CreatePostInput, UpdatePostInput } from '../validators/posts';

// Helper to extract hashtags from content
function extractHashtags(content: string): string[] {
  const regex = /#([a-zA-Z0-9_\u10D0-\u10FF]+)/g;
  const matches = content.match(regex);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

interface PostAuthor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface PostImage {
  id: string;
  url: string;
  order: number;
}

interface PostResponse {
  id: string;
  content: string;
  author: PostAuthor;
  images: PostImage[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  isLiked: boolean;
  hashtags: string[];
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

export const postsService = {
  async createPost(
    userId: string,
    data: CreatePostInput,
    files?: Express.Multer.File[]
  ): Promise<PostResponse> {
    const hashtags = extractHashtags(data.content);

    // Upload images if provided
    let imageUrls: { url: string }[] = [];
    if (files && files.length > 0) {
      const uploadResults = await uploadFiles(files, 'posts', userId);
      imageUrls = uploadResults.map((r) => ({ url: r.url }));
    }

    // Create post with images and hashtags in a transaction
    const post = await prisma.$transaction(async (tx) => {
      // Create or get hashtags
      const hashtagRecords = await Promise.all(
        hashtags.map(async (name) => {
          const existing = await tx.hashtag.findUnique({ where: { name } });
          if (existing) {
            await tx.hashtag.update({
              where: { id: existing.id },
              data: { postCount: { increment: 1 } },
            });
            return existing;
          }
          return tx.hashtag.create({
            data: { name, postCount: 1 },
          });
        })
      );

      // Create post
      const newPost = await tx.post.create({
        data: {
          content: data.content,
          userId,
          images: {
            create: imageUrls.map((img, index) => ({
              url: img.url,
              order: index,
            })),
          },
          hashtags: {
            create: hashtagRecords.map((h) => ({
              hashtagId: h.id,
            })),
          },
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
          images: {
            orderBy: { order: 'asc' },
          },
          hashtags: {
            include: { hashtag: true },
          },
        },
      });

      return newPost;
    });

    return {
      id: post.id,
      content: post.content,
      author: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        avatarUrl: post.user.avatarUrl,
      },
      images: post.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewCount: post.viewCount,
      isLiked: false,
      hashtags: post.hashtags.map((h) => h.hashtag.name),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  },

  async getPostById(postId: string, currentUserId?: string): Promise<PostResponse> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
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
        images: {
          orderBy: { order: 'asc' },
        },
        hashtags: {
          include: { hashtag: true },
        },
      },
    });

    if (!post || post.isDeleted || !post.user.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'პოსტი ვერ მოიძებნა');
    }

    // Check if blocked
    if (currentUserId && currentUserId !== post.userId) {
      const isBlocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: post.userId, blockedId: currentUserId },
            { blockerId: currentUserId, blockedId: post.userId },
          ],
        },
      });

      if (isBlocked) {
        throw new AppError(403, 'BLOCKED', 'პოსტი მიუწვდომელია');
      }
    }

    // Check if liked
    let isLiked = false;
    if (currentUserId) {
      const like = await prisma.like.findUnique({
        where: {
          userId_postId: { userId: currentUserId, postId },
        },
      });
      isLiked = !!like;
    }

    // Increment view count
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });

    return {
      id: post.id,
      content: post.content,
      author: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        avatarUrl: post.user.avatarUrl,
      },
      images: post.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewCount: post.viewCount + 1,
      isLiked,
      hashtags: post.hashtags.map((h) => h.hashtag.name),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  },

  async getFeed(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<PostResponse>> {
    const skip = (page - 1) * limit;

    // Get blocked user IDs
    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    });

    const blockedIds = new Set<string>();
    blocks.forEach((b) => {
      blockedIds.add(b.blockerId);
      blockedIds.add(b.blockedId);
    });
    blockedIds.delete(userId);

    // Get following IDs
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);

    // Include own posts and following posts
    const userIds = [userId, ...followingIds].filter((id) => !blockedIds.has(id));

    const where = {
      userId: { in: userIds },
      isDeleted: false,
      user: { isActive: true },
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
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
          images: {
            orderBy: { order: 'asc' },
          },
          hashtags: {
            include: { hashtag: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count({ where }),
    ]);

    // Get liked posts
    const postIds = posts.map((p) => p.id);
    const likes = await prisma.like.findMany({
      where: {
        userId,
        postId: { in: postIds },
      },
      select: { postId: true },
    });
    const likedPostIds = new Set(likes.map((l) => l.postId));

    const items: PostResponse[] = posts.map((post) => ({
      id: post.id,
      content: post.content,
      author: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        avatarUrl: post.user.avatarUrl,
      },
      images: post.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewCount: post.viewCount,
      isLiked: likedPostIds.has(post.id),
      hashtags: post.hashtags.map((h) => h.hashtag.name),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
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

  async getTrending(
    page: number,
    limit: number,
    currentUserId?: string
  ): Promise<PaginatedResult<PostResponse>> {
    const skip = (page - 1) * limit;

    // Get blocked user IDs if authenticated
    const blockedIds = new Set<string>();
    if (currentUserId) {
      const blocks = await prisma.block.findMany({
        where: {
          OR: [{ blockerId: currentUserId }, { blockedId: currentUserId }],
        },
        select: { blockerId: true, blockedId: true },
      });

      blocks.forEach((b) => {
        blockedIds.add(b.blockerId);
        blockedIds.add(b.blockedId);
      });
      blockedIds.delete(currentUserId);
    }

    const where = {
      isDeleted: false,
      user: { isActive: true },
      ...(blockedIds.size > 0 && { userId: { notIn: Array.from(blockedIds) } }),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
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
          images: {
            orderBy: { order: 'asc' },
          },
          hashtags: {
            include: { hashtag: true },
          },
        },
        skip,
        take: limit,
        orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.post.count({ where }),
    ]);

    // Get liked posts
    let likedPostIds = new Set<string>();
    if (currentUserId) {
      const postIds = posts.map((p) => p.id);
      const likes = await prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      });
      likedPostIds = new Set(likes.map((l) => l.postId));
    }

    const items: PostResponse[] = posts.map((post) => ({
      id: post.id,
      content: post.content,
      author: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        avatarUrl: post.user.avatarUrl,
      },
      images: post.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewCount: post.viewCount,
      isLiked: likedPostIds.has(post.id),
      hashtags: post.hashtags.map((h) => h.hashtag.name),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
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

  async getUserPosts(
    targetUserId: string,
    page: number,
    limit: number,
    currentUserId?: string
  ): Promise<PaginatedResult<PostResponse>> {
    const skip = (page - 1) * limit;

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    // Check if blocked
    if (currentUserId && currentUserId !== targetUserId) {
      const isBlocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: targetUserId, blockedId: currentUserId },
            { blockerId: currentUserId, blockedId: targetUserId },
          ],
        },
      });

      if (isBlocked) {
        throw new AppError(403, 'BLOCKED', 'პროფილი მიუწვდომელია');
      }
    }

    const where = {
      userId: targetUserId,
      isDeleted: false,
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
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
          images: {
            orderBy: { order: 'asc' },
          },
          hashtags: {
            include: { hashtag: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count({ where }),
    ]);

    // Get liked posts
    let likedPostIds = new Set<string>();
    if (currentUserId) {
      const postIds = posts.map((p) => p.id);
      const likes = await prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      });
      likedPostIds = new Set(likes.map((l) => l.postId));
    }

    const items: PostResponse[] = posts.map((post) => ({
      id: post.id,
      content: post.content,
      author: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        avatarUrl: post.user.avatarUrl,
      },
      images: post.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewCount: post.viewCount,
      isLiked: likedPostIds.has(post.id),
      hashtags: post.hashtags.map((h) => h.hashtag.name),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
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

  async getPostsByHashtag(
    tag: string,
    page: number,
    limit: number,
    currentUserId?: string
  ): Promise<PaginatedResult<PostResponse>> {
    const skip = (page - 1) * limit;
    const normalizedTag = tag.toLowerCase();

    // Get blocked user IDs if authenticated
    const blockedIds = new Set<string>();
    if (currentUserId) {
      const blocks = await prisma.block.findMany({
        where: {
          OR: [{ blockerId: currentUserId }, { blockedId: currentUserId }],
        },
        select: { blockerId: true, blockedId: true },
      });

      blocks.forEach((b) => {
        blockedIds.add(b.blockerId);
        blockedIds.add(b.blockedId);
      });
      blockedIds.delete(currentUserId);
    }

    const hashtag = await prisma.hashtag.findUnique({
      where: { name: normalizedTag },
    });

    if (!hashtag) {
      return {
        items: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const where = {
      hashtags: { some: { hashtagId: hashtag.id } },
      isDeleted: false,
      user: { isActive: true },
      ...(blockedIds.size > 0 && { userId: { notIn: Array.from(blockedIds) } }),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
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
          images: {
            orderBy: { order: 'asc' },
          },
          hashtags: {
            include: { hashtag: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count({ where }),
    ]);

    // Get liked posts
    let likedPostIds = new Set<string>();
    if (currentUserId) {
      const postIds = posts.map((p) => p.id);
      const likes = await prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      });
      likedPostIds = new Set(likes.map((l) => l.postId));
    }

    const items: PostResponse[] = posts.map((post) => ({
      id: post.id,
      content: post.content,
      author: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        avatarUrl: post.user.avatarUrl,
      },
      images: post.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewCount: post.viewCount,
      isLiked: likedPostIds.has(post.id),
      hashtags: post.hashtags.map((h) => h.hashtag.name),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
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

  async updatePost(
    postId: string,
    userId: string,
    data: UpdatePostInput
  ): Promise<PostResponse> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        hashtags: { include: { hashtag: true } },
      },
    });

    if (!post || post.isDeleted) {
      throw new AppError(404, 'NOT_FOUND', 'პოსტი ვერ მოიძებნა');
    }

    if (post.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ რედაქტირების უფლება');
    }

    // Extract new hashtags
    const newHashtags = extractHashtags(data.content);
    const oldHashtags = post.hashtags.map((h) => h.hashtag.name);

    // Hashtags to add
    const hashtagsToAdd = newHashtags.filter((h) => !oldHashtags.includes(h));
    // Hashtags to remove
    const hashtagsToRemove = oldHashtags.filter((h) => !newHashtags.includes(h));

    const updatedPost = await prisma.$transaction(async (tx) => {
      // Decrement count for removed hashtags
      for (const name of hashtagsToRemove) {
        await tx.hashtag.updateMany({
          where: { name },
          data: { postCount: { decrement: 1 } },
        });
      }

      // Delete old hashtag relations
      await tx.postHashtag.deleteMany({
        where: {
          postId,
          hashtag: { name: { in: hashtagsToRemove } },
        },
      });

      // Create or get new hashtags
      const hashtagRecords = await Promise.all(
        hashtagsToAdd.map(async (name) => {
          const existing = await tx.hashtag.findUnique({ where: { name } });
          if (existing) {
            await tx.hashtag.update({
              where: { id: existing.id },
              data: { postCount: { increment: 1 } },
            });
            return existing;
          }
          return tx.hashtag.create({
            data: { name, postCount: 1 },
          });
        })
      );

      // Create new hashtag relations
      if (hashtagRecords.length > 0) {
        await tx.postHashtag.createMany({
          data: hashtagRecords.map((h) => ({
            postId,
            hashtagId: h.id,
          })),
        });
      }

      // Update post
      return tx.post.update({
        where: { id: postId },
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
          images: {
            orderBy: { order: 'asc' },
          },
          hashtags: {
            include: { hashtag: true },
          },
        },
      });
    });

    return {
      id: updatedPost.id,
      content: updatedPost.content,
      author: {
        id: updatedPost.user.id,
        username: updatedPost.user.username,
        fullName: updatedPost.user.fullName,
        avatarUrl: updatedPost.user.avatarUrl,
      },
      images: updatedPost.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      likeCount: updatedPost.likeCount,
      commentCount: updatedPost.commentCount,
      viewCount: updatedPost.viewCount,
      isLiked: false,
      hashtags: updatedPost.hashtags.map((h) => h.hashtag.name),
      createdAt: updatedPost.createdAt,
      updatedAt: updatedPost.updatedAt,
    };
  },

  async deletePost(postId: string, userId: string): Promise<void> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        images: true,
        hashtags: { include: { hashtag: true } },
      },
    });

    if (!post || post.isDeleted) {
      throw new AppError(404, 'NOT_FOUND', 'პოსტი ვერ მოიძებნა');
    }

    if (post.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ წაშლის უფლება');
    }

    await prisma.$transaction(async (tx) => {
      // Decrement hashtag counts
      for (const h of post.hashtags) {
        await tx.hashtag.update({
          where: { id: h.hashtag.id },
          data: { postCount: { decrement: 1 } },
        });
      }

      // Soft delete post
      await tx.post.update({
        where: { id: postId },
        data: { isDeleted: true },
      });
    });

    // Delete images from R2
    const imageKeys = post.images
      .map((img) => extractKeyFromUrl(img.url))
      .filter((key): key is string => key !== null);

    if (imageKeys.length > 0) {
      await deleteFiles(imageKeys);
    }
  },

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, isDeleted: true, likeCount: true },
    });

    if (!post || post.isDeleted) {
      throw new AppError(404, 'NOT_FOUND', 'პოსტი ვერ მოიძებნა');
    }

    // Check if blocked
    if (post.userId !== userId) {
      const isBlocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: post.userId, blockedId: userId },
            { blockerId: userId, blockedId: post.userId },
          ],
        },
      });

      if (isBlocked) {
        throw new AppError(403, 'BLOCKED', 'ლაიქი შეუძლებელია');
      }
    }

    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.$transaction([
        prisma.like.delete({
          where: { id: existingLike.id },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);

      return { liked: false, likeCount: post.likeCount - 1 };
    } else {
      // Like
      await prisma.$transaction([
        prisma.like.create({
          data: { userId, postId },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);

      // TODO: Create notification for post owner

      return { liked: true, likeCount: post.likeCount + 1 };
    }
  },
};
