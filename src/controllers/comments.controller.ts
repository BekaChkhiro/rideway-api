import { Request, Response } from 'express';
import { commentsService } from '../services/comments.service';
import { CreateCommentInput, UpdateCommentInput } from '../validators/posts';

export const commentsController = {
  async createComment(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: postId } = req.params;
    const data = req.body as CreateCommentInput;

    const comment = await commentsService.createComment(postId, userId, data);

    res.status(201).json({
      success: true,
      data: comment,
    });
  },

  async getComments(req: Request, res: Response) {
    const { id: postId } = req.params;
    const currentUserId = req.user?.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await commentsService.getComments(postId, pageNum, limitNum, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getReplies(req: Request, res: Response) {
    const { commentId } = req.params;
    const currentUserId = req.user?.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await commentsService.getReplies(commentId, pageNum, limitNum, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async updateComment(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { commentId } = req.params;
    const data = req.body as UpdateCommentInput;

    const comment = await commentsService.updateComment(commentId, userId, data);

    res.json({
      success: true,
      data: comment,
    });
  },

  async deleteComment(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { commentId } = req.params;

    await commentsService.deleteComment(commentId, userId);

    res.json({
      success: true,
      data: { message: 'კომენტარი წაშლილია' },
    });
  },

  async toggleLike(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { commentId } = req.params;

    const result = await commentsService.toggleLike(commentId, userId);

    res.json({
      success: true,
      data: result,
    });
  },
};
