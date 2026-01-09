import { Request, Response } from 'express';
import { servicesService } from '../services/services.service';
import {
  CreateServiceInput,
  UpdateServiceInput,
  GetServicesQuery,
  SearchServicesQuery,
  CreateReviewInput,
  GetReviewsQuery,
} from '../validators/services';

export const servicesController = {
  // ==================== CATEGORIES ====================

  async getCategories(req: Request, res: Response) {
    const categories = await servicesService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  },

  // ==================== SERVICES CRUD ====================

  async createService(req: Request, res: Response) {
    const userId = req.user!.userId;
    const data = req.body as CreateServiceInput;
    const files = req.files as Express.Multer.File[] | undefined;

    const service = await servicesService.createService(userId, data, files);

    res.status(201).json({
      success: true,
      data: service,
    });
  },

  async getService(req: Request, res: Response) {
    const { id } = req.params;

    const service = await servicesService.getServiceById(id);

    res.json({
      success: true,
      data: service,
    });
  },

  async getServices(req: Request, res: Response) {
    const rawQuery = req.query as Record<string, string | undefined>;

    const query: GetServicesQuery = {
      page: Math.max(1, parseInt(rawQuery.page || '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(rawQuery.limit || '20', 10) || 20)),
      categoryId: rawQuery.categoryId,
      location: rawQuery.location,
      sort: (rawQuery.sort as GetServicesQuery['sort']) || 'latest',
    };

    const result = await servicesService.getServices(query);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async searchServices(req: Request, res: Response) {
    const rawQuery = req.query as Record<string, string | undefined>;

    const query: SearchServicesQuery = {
      q: rawQuery.q || '',
      page: Math.max(1, parseInt(rawQuery.page || '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(rawQuery.limit || '20', 10) || 20)),
    };

    const result = await servicesService.searchServices(query);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getUserServices(req: Request, res: Response) {
    const { userId } = req.params;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await servicesService.getUserServices(userId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async updateService(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = req.body as UpdateServiceInput;

    const service = await servicesService.updateService(id, userId, data);

    res.json({
      success: true,
      data: service,
    });
  },

  async deleteService(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    await servicesService.deleteService(id, userId);

    res.json({
      success: true,
      data: { message: 'სერვისი წაშლილია' },
    });
  },

  // ==================== REVIEWS ====================

  async createReview(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: serviceId } = req.params;
    const data = req.body as CreateReviewInput;

    const review = await servicesService.createReview(serviceId, userId, data);

    res.status(201).json({
      success: true,
      data: review,
    });
  },

  async getReviews(req: Request, res: Response) {
    const { id: serviceId } = req.params;
    const rawQuery = req.query as Record<string, string | undefined>;

    const query: GetReviewsQuery = {
      page: Math.max(1, parseInt(rawQuery.page || '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(rawQuery.limit || '20', 10) || 20)),
    };

    const result = await servicesService.getReviews(serviceId, query);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async deleteReview(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: serviceId } = req.params;

    await servicesService.deleteReview(serviceId, userId);

    res.json({
      success: true,
      data: { message: 'შეფასება წაშლილია' },
    });
  },
};
