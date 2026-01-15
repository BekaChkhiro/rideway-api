import { Request, Response } from 'express';
import { usersService } from '../services/users.service';
import { UpdateProfileInput } from '../validators/users';

export const usersController = {
  async getProfile(req: Request, res: Response) {
    const { username } = req.params;
    const currentUserId = req.user?.userId;

    const profile = await usersService.getProfileByUsername(username, currentUserId);

    res.json({
      success: true,
      data: profile,
    });
  },

  async updateProfile(req: Request, res: Response) {
    const userId = req.user!.userId;
    const data = req.body as UpdateProfileInput;
    const profile = await usersService.updateProfile(userId, data);

    res.json({
      success: true,
      data: profile,
    });
  },

  async searchUsers(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { q, page, limit } = req.query as { q: string; page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await usersService.searchUsers(q, userId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getFollowers(req: Request, res: Response) {
    const currentUserId = req.user!.userId;
    const { id } = req.params;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await usersService.getFollowers(id, currentUserId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getFollowing(req: Request, res: Response) {
    const currentUserId = req.user!.userId;
    const { id } = req.params;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await usersService.getFollowing(id, currentUserId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async follow(req: Request, res: Response) {
    const currentUserId = req.user!.userId;
    const { id } = req.params;

    await usersService.follow(currentUserId, id);

    res.json({
      success: true,
      data: { message: 'გამოწერილია' },
    });
  },

  async unfollow(req: Request, res: Response) {
    const currentUserId = req.user!.userId;
    const { id } = req.params;

    await usersService.unfollow(currentUserId, id);

    res.json({
      success: true,
      data: { message: 'გამოწერა გაუქმებულია' },
    });
  },

  async block(req: Request, res: Response) {
    const currentUserId = req.user!.userId;
    const { id } = req.params;

    await usersService.block(currentUserId, id);

    res.json({
      success: true,
      data: { message: 'დაბლოკილია' },
    });
  },

  async unblock(req: Request, res: Response) {
    const currentUserId = req.user!.userId;
    const { id } = req.params;

    await usersService.unblock(currentUserId, id);

    res.json({
      success: true,
      data: { message: 'ბლოკი მოხსნილია' },
    });
  },

  async getBlockedUsers(req: Request, res: Response) {
    const currentUserId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await usersService.getBlockedUsers(currentUserId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },
};
