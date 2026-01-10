import { Request, Response } from 'express';
import { postsService } from '../services/posts.service';
import { CreatePostInput, UpdatePostInput } from '../validators/posts';

export const postsController = {
  async createPost(req: Request, res: Response) {
    const userId = req.user!.userId;
    const data = req.body as CreatePostInput;
    const files = req.files as Express.Multer.File[] | undefined;

    const post = await postsService.createPost(userId, data, files);

    res.status(201).json({
      success: true,
      data: post,
    });
  },

  async getPost(req: Request, res: Response) {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    const post = await postsService.getPostById(id, currentUserId);

    res.json({
      success: true,
      data: post,
    });
  },

  async getFeed(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await postsService.getFeed(userId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getTrending(req: Request, res: Response) {
    const currentUserId = req.user?.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await postsService.getTrending(pageNum, limitNum, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getUserPosts(req: Request, res: Response) {
    const { userId } = req.params;
    const currentUserId = req.user?.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await postsService.getUserPosts(userId, pageNum, limitNum, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getLikedPosts(req: Request, res: Response) {
    const { userId } = req.params;
    const currentUserId = req.user?.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await postsService.getLikedPosts(userId, pageNum, limitNum, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getPostsByHashtag(req: Request, res: Response) {
    const { tag } = req.params;
    const currentUserId = req.user?.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await postsService.getPostsByHashtag(tag, pageNum, limitNum, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async updatePost(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = req.body as UpdatePostInput;
    const files = req.files as Express.Multer.File[] | undefined;

    const post = await postsService.updatePost(id, userId, data, files);

    res.json({
      success: true,
      data: post,
    });
  },

  async deletePost(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    await postsService.deletePost(id, userId);

    res.json({
      success: true,
      data: { message: 'პოსტი წაშლილია' },
    });
  },

  async toggleLike(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await postsService.toggleLike(id, userId);

    res.json({
      success: true,
      data: result,
    });
  },

  async getSavedPosts(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await postsService.getSavedPosts(userId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async toggleSave(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await postsService.toggleSave(id, userId);

    res.json({
      success: true,
      data: result,
    });
  },

  async getTrendingHashtags(req: Request, res: Response) {
    const { limit } = req.query as { limit?: string };
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '10', 10) || 10));

    const hashtags = await postsService.getTrendingHashtags(limitNum);

    res.json({
      success: true,
      data: hashtags,
    });
  },
};
