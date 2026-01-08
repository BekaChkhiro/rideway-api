import { prisma } from '../config/database';
import { AppError } from '../middleware/error-handler';
import { CreateCommentInput, UpdateCommentInput } from '../validators/posts';

interface CommentAuthor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface CommentResponse {
  id: string;
  content: string;
  author: CommentAuthor;
  postId: string;
  parentId: string | null;
  likeCount: number;
  isLiked: boolean;
  repliesCount: number;
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

export const commentsService = {
  async createComment(
    postId: string,
    userId: string,
    data: CreateCommentInput
  ): Promise<CommentResponse> {
    // Check if post exists and is not deleted
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, isDeleted: true },
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
        throw new AppError(403, 'BLOCKED', 'კომენტარის დატოვება შეუძლებელია');
      }
    }

    // Check if parent comment exists (if replying)
    if (data.parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: data.parentId },
        select: { id: true, postId: true },
      });

      if (!parentComment || parentComment.postId !== postId) {
        throw new AppError(404, 'NOT_FOUND', 'კომენტარი ვერ მოიძებნა');
      }
    }

    // Create comment and increment post comment count
    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          content: data.content,
          userId,
          postId,
          parentId: data.parentId || null,
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
          _count: {
            select: { replies: true },
          },
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    // TODO: Create notification for post owner (if not own post)
    // TODO: Create notification for parent comment owner (if replying)

    return {
      id: comment.id,
      content: comment.content,
      author: {
        id: comment.user.id,
        username: comment.user.username,
        fullName: comment.user.fullName,
        avatarUrl: comment.user.avatarUrl,
      },
      postId: comment.postId,
      parentId: comment.parentId,
      likeCount: comment.likeCount,
      isLiked: false,
      repliesCount: comment._count.replies,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  },

  async getComments(
    postId: string,
    page: number,
    limit: number,
    currentUserId?: string
  ): Promise<PaginatedResult<CommentResponse>> {
    const skip = (page - 1) * limit;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, isDeleted: true },
    });

    if (!post || post.isDeleted) {
      throw new AppError(404, 'NOT_FOUND', 'პოსტი ვერ მოიძებნა');
    }

    // Check if blocked
    if (currentUserId && post.userId !== currentUserId) {
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

    // Get only top-level comments (no parentId)
    const where = {
      postId,
      parentId: null,
    };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
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
          _count: {
            select: { replies: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.comment.count({ where }),
    ]);

    // Get liked comments
    let likedCommentIds = new Set<string>();
    if (currentUserId) {
      const commentIds = comments.map((c) => c.id);
      const likes = await prisma.commentLike.findMany({
        where: {
          userId: currentUserId,
          commentId: { in: commentIds },
        },
        select: { commentId: true },
      });
      likedCommentIds = new Set(likes.map((l) => l.commentId));
    }

    const items: CommentResponse[] = comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      author: {
        id: comment.user.id,
        username: comment.user.username,
        fullName: comment.user.fullName,
        avatarUrl: comment.user.avatarUrl,
      },
      postId: comment.postId,
      parentId: comment.parentId,
      likeCount: comment.likeCount,
      isLiked: likedCommentIds.has(comment.id),
      repliesCount: comment._count.replies,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
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

  async getReplies(
    commentId: string,
    page: number,
    limit: number,
    currentUserId?: string
  ): Promise<PaginatedResult<CommentResponse>> {
    const skip = (page - 1) * limit;

    // Check if comment exists
    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          select: { id: true, userId: true, isDeleted: true },
        },
      },
    });

    if (!parentComment || parentComment.post.isDeleted) {
      throw new AppError(404, 'NOT_FOUND', 'კომენტარი ვერ მოიძებნა');
    }

    // Check if blocked
    if (currentUserId && parentComment.post.userId !== currentUserId) {
      const isBlocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: parentComment.post.userId, blockedId: currentUserId },
            { blockerId: currentUserId, blockedId: parentComment.post.userId },
          ],
        },
      });

      if (isBlocked) {
        throw new AppError(403, 'BLOCKED', 'კომენტარი მიუწვდომელია');
      }
    }

    const where = { parentId: commentId };

    const [replies, total] = await Promise.all([
      prisma.comment.findMany({
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
          _count: {
            select: { replies: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.comment.count({ where }),
    ]);

    // Get liked replies
    let likedCommentIds = new Set<string>();
    if (currentUserId) {
      const replyIds = replies.map((r) => r.id);
      const likes = await prisma.commentLike.findMany({
        where: {
          userId: currentUserId,
          commentId: { in: replyIds },
        },
        select: { commentId: true },
      });
      likedCommentIds = new Set(likes.map((l) => l.commentId));
    }

    const items: CommentResponse[] = replies.map((reply) => ({
      id: reply.id,
      content: reply.content,
      author: {
        id: reply.user.id,
        username: reply.user.username,
        fullName: reply.user.fullName,
        avatarUrl: reply.user.avatarUrl,
      },
      postId: reply.postId,
      parentId: reply.parentId,
      likeCount: reply.likeCount,
      isLiked: likedCommentIds.has(reply.id),
      repliesCount: reply._count.replies,
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

  async updateComment(
    commentId: string,
    userId: string,
    data: UpdateCommentInput
  ): Promise<CommentResponse> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, postId: true },
    });

    if (!comment) {
      throw new AppError(404, 'NOT_FOUND', 'კომენტარი ვერ მოიძებნა');
    }

    if (comment.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ რედაქტირების უფლება');
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
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
        _count: {
          select: { replies: true },
        },
      },
    });

    return {
      id: updatedComment.id,
      content: updatedComment.content,
      author: {
        id: updatedComment.user.id,
        username: updatedComment.user.username,
        fullName: updatedComment.user.fullName,
        avatarUrl: updatedComment.user.avatarUrl,
      },
      postId: updatedComment.postId,
      parentId: updatedComment.parentId,
      likeCount: updatedComment.likeCount,
      isLiked: false,
      repliesCount: updatedComment._count.replies,
      createdAt: updatedComment.createdAt,
      updatedAt: updatedComment.updatedAt,
    };
  },

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, postId: true },
    });

    if (!comment) {
      throw new AppError(404, 'NOT_FOUND', 'კომენტარი ვერ მოიძებნა');
    }

    if (comment.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ წაშლის უფლება');
    }

    // Count total comments to delete (comment + all replies)
    const repliesCount = await prisma.comment.count({
      where: { parentId: commentId },
    });
    const totalToDelete = 1 + repliesCount;

    await prisma.$transaction([
      // Delete comment (cascade will delete replies)
      prisma.comment.delete({
        where: { id: commentId },
      }),
      // Decrement post comment count
      prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: totalToDelete } },
      }),
    ]);
  },

  async toggleLike(
    commentId: string,
    userId: string
  ): Promise<{ liked: boolean; likeCount: number }> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          select: { userId: true, isDeleted: true },
        },
      },
    });

    if (!comment || comment.post.isDeleted) {
      throw new AppError(404, 'NOT_FOUND', 'კომენტარი ვერ მოიძებნა');
    }

    // Check if blocked
    if (comment.userId !== userId) {
      const isBlocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: comment.userId, blockedId: userId },
            { blockerId: userId, blockedId: comment.userId },
          ],
        },
      });

      if (isBlocked) {
        throw new AppError(403, 'BLOCKED', 'ლაიქი შეუძლებელია');
      }
    }

    const existingLike = await prisma.commentLike.findUnique({
      where: {
        userId_commentId: { userId, commentId },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.$transaction([
        prisma.commentLike.delete({
          where: { id: existingLike.id },
        }),
        prisma.comment.update({
          where: { id: commentId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);

      return { liked: false, likeCount: comment.likeCount - 1 };
    } else {
      // Like
      await prisma.$transaction([
        prisma.commentLike.create({
          data: { userId, commentId },
        }),
        prisma.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);

      return { liked: true, likeCount: comment.likeCount + 1 };
    }
  },
};
