import { Request, Response } from 'express';
import { listingsService } from '../services/listings.service';
import {
  CreateListingInput,
  UpdateListingInput,
  GetListingsQuery,
  SearchListingsQuery,
  PopularListingsQuery,
  UserListingsQuery,
} from '../validators/listings';

export const listingsController = {
  // ==================== CATEGORIES ====================

  async getCategories(req: Request, res: Response) {
    const categories = await listingsService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  },

  // ==================== LISTINGS CRUD ====================

  async createListing(req: Request, res: Response) {
    const userId = req.user!.userId;
    const data = req.body as CreateListingInput;
    const files = req.files as Express.Multer.File[] | undefined;

    const listing = await listingsService.createListing(userId, data, files);

    res.status(201).json({
      success: true,
      data: listing,
    });
  },

  async getListing(req: Request, res: Response) {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    const listing = await listingsService.getListingById(id, currentUserId);

    res.json({
      success: true,
      data: listing,
    });
  },

  async getListings(req: Request, res: Response) {
    const rawQuery = req.query as Record<string, string | undefined>;
    const currentUserId = req.user?.userId;

    const query: GetListingsQuery = {
      page: Math.max(1, parseInt(rawQuery.page || '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(rawQuery.limit || '20', 10) || 20)),
      categoryId: rawQuery.categoryId,
      minPrice: rawQuery.minPrice ? parseFloat(rawQuery.minPrice) : undefined,
      maxPrice: rawQuery.maxPrice ? parseFloat(rawQuery.maxPrice) : undefined,
      condition: rawQuery.condition as GetListingsQuery['condition'],
      brand: rawQuery.brand,
      status: (rawQuery.status as GetListingsQuery['status']) || 'ACTIVE',
      sort: (rawQuery.sort as GetListingsQuery['sort']) || 'latest',
      type: rawQuery.type as GetListingsQuery['type'],
      locationType: rawQuery.locationType as GetListingsQuery['locationType'],
      motorcycleCategory: rawQuery.motorcycleCategory as GetListingsQuery['motorcycleCategory'],
      customsStatus: rawQuery.customsStatus as GetListingsQuery['customsStatus'],
      transmission: rawQuery.transmission as GetListingsQuery['transmission'],
      minYear: rawQuery.minYear ? parseInt(rawQuery.minYear, 10) : undefined,
      maxYear: rawQuery.maxYear ? parseInt(rawQuery.maxYear, 10) : undefined,
      minEngineCC: rawQuery.minEngineCC ? parseInt(rawQuery.minEngineCC, 10) : undefined,
      maxEngineCC: rawQuery.maxEngineCC ? parseInt(rawQuery.maxEngineCC, 10) : undefined,
    };

    const result = await listingsService.getListings(query, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async searchListings(req: Request, res: Response) {
    const rawQuery = req.query as Record<string, string | undefined>;
    const currentUserId = req.user?.userId;

    const query: SearchListingsQuery = {
      q: rawQuery.q || '',
      page: Math.max(1, parseInt(rawQuery.page || '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(rawQuery.limit || '20', 10) || 20)),
    };

    const result = await listingsService.searchListings(query, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async getPopularListings(req: Request, res: Response) {
    const rawQuery = req.query as Record<string, string | undefined>;
    const currentUserId = req.user?.userId;

    const query: PopularListingsQuery = {
      limit: Math.min(20, Math.max(1, parseInt(rawQuery.limit || '10', 10) || 10)),
    };

    const listings = await listingsService.getPopularListings(query, currentUserId);

    res.json({
      success: true,
      data: listings,
    });
  },

  async getUserListings(req: Request, res: Response) {
    const { userId } = req.params;
    const rawQuery = req.query as Record<string, string | undefined>;
    const currentUserId = req.user?.userId;

    const query: UserListingsQuery = {
      page: Math.max(1, parseInt(rawQuery.page || '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(rawQuery.limit || '20', 10) || 20)),
      status: rawQuery.status as UserListingsQuery['status'],
    };

    const result = await listingsService.getUserListings(userId, query, currentUserId);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  async updateListing(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = req.body as UpdateListingInput;

    const listing = await listingsService.updateListing(id, userId, data);

    res.json({
      success: true,
      data: listing,
    });
  },

  async deleteListing(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    await listingsService.deleteListing(id, userId);

    res.json({
      success: true,
      data: { message: 'განცხადება წაშლილია' },
    });
  },

  async markAsSold(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const listing = await listingsService.markAsSold(id, userId);

    res.json({
      success: true,
      data: listing,
    });
  },

  // ==================== FAVORITES ====================

  async toggleFavorite(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await listingsService.toggleFavorite(id, userId);

    res.json({
      success: true,
      data: result,
    });
  },

  async removeFavorite(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Toggle will remove if already favorite
    const result = await listingsService.toggleFavorite(id, userId);

    // If it was added (meaning it wasn't a favorite), toggle again to remove
    if (result.isFavorite) {
      await listingsService.toggleFavorite(id, userId);
    }

    res.json({
      success: true,
      data: { message: 'ფავორიტებიდან წაშლილია' },
    });
  },

  async getFavorites(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await listingsService.getFavorites(userId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },
};
