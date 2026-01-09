import { Request, Response } from 'express';
import { forumService } from '../services/forum.service';
import {
  CreateThreadInput,
  UpdateThreadInput,
  GetThreadsQuery,
  CreateReplyInput,
  UpdateReplyInput,
  GetRepliesQuery,
} from '../validators/forum';

export const forumController = {
  // ==================== CATEGORIES ====================

  async getCategories(req: Request, res: Response) {
    const categories = await forumService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  },

  // ==================== THREADS ====================

  async createThread(req: Request, res: Response) {
    const userId = req.user!.userId;
    const data = req.body as CreateThreadInput;

    const thread = await forumService.createThread(userId, data);

    res.status(201).json({
      success: true,
      data: thread,
    });
  },

  async getThread(req: Request, res: Response) {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    const thread = await forumService.getThreadById(id, currentUserId);

    res.json({
      success: true,
      data: thread,
    });
  },

  async getThreads(req: Request, res: Response) {
    const rawQuery = req.query as Record<string, string | undefined>;
    const currentUserId = req.user?.userId;

    const query: GetThreadsQuery = {
      page: Math.max(1, parseInt(rawQuery.page || '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(rawQuery.limit || '20', 10) || 20)),
      categoryId: rawQuery.categoryId,
      sort: (rawQuery.sort as GetThreadsQuery['sort']) || 'latest',
    };

    const result = await forumService.getThreads(query, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async updateThread(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = req.body as UpdateThreadInput;

    const thread = await forumService.updateThread(id, userId, data);

    res.json({
      success: true,
      data: thread,
    });
  },

  async deleteThread(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    await forumService.deleteThread(id, userId);

    res.json({
      success: true,
      data: { message: 'თემა წაშლილია' },
    });
  },

  async toggleThreadLike(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await forumService.toggleThreadLike(id, userId);

    res.json({
      success: true,
      data: result,
    });
  },

  // ==================== REPLIES ====================

  async createReply(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: threadId } = req.params;
    const data = req.body as CreateReplyInput;

    const reply = await forumService.createReply(threadId, userId, data);

    res.status(201).json({
      success: true,
      data: reply,
    });
  },

  async getReplies(req: Request, res: Response) {
    const { id: threadId } = req.params;
    const rawQuery = req.query as Record<string, string | undefined>;
    const currentUserId = req.user?.userId;

    const query: GetRepliesQuery = {
      page: Math.max(1, parseInt(rawQuery.page || '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(rawQuery.limit || '20', 10) || 20)),
    };

    const result = await forumService.getReplies(threadId, query, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async updateReply(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { replyId } = req.params;
    const data = req.body as UpdateReplyInput;

    const reply = await forumService.updateReply(replyId, userId, data);

    res.json({
      success: true,
      data: reply,
    });
  },

  async deleteReply(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { replyId } = req.params;

    await forumService.deleteReply(replyId, userId);

    res.json({
      success: true,
      data: { message: 'პასუხი წაშლილია' },
    });
  },

  async toggleReplyLike(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { replyId } = req.params;

    const result = await forumService.toggleReplyLike(replyId, userId);

    res.json({
      success: true,
      data: result,
    });
  },
};
