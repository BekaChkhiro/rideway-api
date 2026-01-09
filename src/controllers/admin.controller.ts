import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { Role } from '@prisma/client';
import {
  AdminGetUsersInput,
  AdminGetContentInput,
  BanUserInput,
} from '../validators/admin';

export const adminController = {
  // ==================== USERS ====================

  async getUsers(req: Request, res: Response) {
    const params = req.query as unknown as AdminGetUsersInput;
    const result = await adminService.getUsers(params);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getUserById(req: Request, res: Response) {
    const { id } = req.params;
    const user = await adminService.getUserById(id);

    res.json({
      success: true,
      data: user,
    });
  },

  async changeUserRole(req: Request, res: Response) {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const { role } = req.body as { role: Role };

    const user = await adminService.changeUserRole(adminId, id, role);

    res.json({
      success: true,
      data: user,
    });
  },

  async banUser(req: Request, res: Response) {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const data = req.body as BanUserInput;

    const user = await adminService.banUser(adminId, id, data);

    res.json({
      success: true,
      data: user,
    });
  },

  async unbanUser(req: Request, res: Response) {
    const adminId = req.user!.userId;
    const { id } = req.params;

    const user = await adminService.unbanUser(adminId, id);

    res.json({
      success: true,
      data: user,
    });
  },

  async deleteUser(req: Request, res: Response) {
    const adminId = req.user!.userId;
    const { id } = req.params;

    await adminService.deleteUser(adminId, id);

    res.json({
      success: true,
      data: { message: 'მომხმარებელი წაშლილია' },
    });
  },

  // ==================== CONTENT MODERATION ====================

  async getPosts(req: Request, res: Response) {
    const params = req.query as unknown as AdminGetContentInput;
    const result = await adminService.getPosts(params);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async deletePost(req: Request, res: Response) {
    const { id } = req.params;
    const { reason } = req.body as { reason: string };

    await adminService.deletePost(id, reason);

    res.json({
      success: true,
      data: { message: 'პოსტი წაშლილია' },
    });
  },

  async getComments(req: Request, res: Response) {
    const params = req.query as unknown as AdminGetContentInput;
    const result = await adminService.getComments(params);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async deleteComment(req: Request, res: Response) {
    const { id } = req.params;
    const { reason } = req.body as { reason: string };

    await adminService.deleteComment(id, reason);

    res.json({
      success: true,
      data: { message: 'კომენტარი წაშლილია' },
    });
  },

  async getListings(req: Request, res: Response) {
    const params = req.query as unknown as AdminGetContentInput;
    const result = await adminService.getListings(params);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async deleteListing(req: Request, res: Response) {
    const { id } = req.params;
    const { reason } = req.body as { reason: string };

    await adminService.deleteListing(id, reason);

    res.json({
      success: true,
      data: { message: 'განცხადება წაშლილია' },
    });
  },

  async getForumThreads(req: Request, res: Response) {
    const params = req.query as unknown as AdminGetContentInput;
    const result = await adminService.getForumThreads(params);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async deleteForumThread(req: Request, res: Response) {
    const { id } = req.params;
    const { reason } = req.body as { reason: string };

    await adminService.deleteForumThread(id, reason);

    res.json({
      success: true,
      data: { message: 'თემა წაშლილია' },
    });
  },

  async toggleThreadPin(req: Request, res: Response) {
    const { id } = req.params;
    const result = await adminService.toggleThreadPin(id);

    res.json({
      success: true,
      data: result,
    });
  },

  async toggleThreadLock(req: Request, res: Response) {
    const { id } = req.params;
    const result = await adminService.toggleThreadLock(id);

    res.json({
      success: true,
      data: result,
    });
  },

  // ==================== DASHBOARD ====================

  async getDashboardStats(req: Request, res: Response) {
    const stats = await adminService.getDashboardStats();

    res.json({
      success: true,
      data: stats,
    });
  },
};
