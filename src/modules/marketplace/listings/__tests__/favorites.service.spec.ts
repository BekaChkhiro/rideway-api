import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from '../favorites.service.js';
import { Listing, ListingStatus, ListingCondition } from '../entities/listing.entity.js';
import { ListingFavorite } from '../entities/listing-favorite.entity.js';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let mockFavoriteRepo: Record<string, Mock>;
  let mockListingRepo: Record<string, Mock>;

  const mockListing: Partial<Listing> = {
    id: 'listing-uuid-1234',
    userId: 'user-uuid-1234',
    title: 'Honda CBR 600RR',
    price: 8500,
    status: ListingStatus.ACTIVE,
    condition: ListingCondition.USED,
    deletedAt: undefined,
  };

  const mockFavorite: Partial<ListingFavorite> = {
    id: 'favorite-uuid-1234',
    listingId: 'listing-uuid-1234',
    userId: 'user-uuid-1234',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockFavoriteRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      findAndCount: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    };

    mockListingRepo = {
      findOne: vi.fn(),
    };

    service = new FavoritesService(mockFavoriteRepo as any, mockListingRepo as any);
  });

  describe('toggle', () => {
    it('should add favorite if not exists', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);
      mockFavoriteRepo.findOne.mockResolvedValue(null);
      mockFavoriteRepo.create.mockReturnValue(mockFavorite);
      mockFavoriteRepo.save.mockResolvedValue(mockFavorite);

      const result = await service.toggle('listing-uuid-1234', 'user-uuid-1234');

      expect(result.isFavorited).toBe(true);
      expect(mockFavoriteRepo.save).toHaveBeenCalled();
    });

    it('should remove favorite if exists', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);
      mockFavoriteRepo.findOne.mockResolvedValue(mockFavorite);
      mockFavoriteRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.toggle('listing-uuid-1234', 'user-uuid-1234');

      expect(result.isFavorited).toBe(false);
      expect(mockFavoriteRepo.delete).toHaveBeenCalledWith(mockFavorite.id);
    });

    it('should throw NotFoundException for non-existent listing', async () => {
      mockListingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.toggle('non-existent-id', 'user-uuid-1234'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('add', () => {
    it('should add a new favorite', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);
      mockFavoriteRepo.findOne.mockResolvedValue(null);
      mockFavoriteRepo.create.mockReturnValue(mockFavorite);
      mockFavoriteRepo.save.mockResolvedValue(mockFavorite);

      const result = await service.add('listing-uuid-1234', 'user-uuid-1234');

      expect(result).toBeDefined();
      expect(result.listingId).toBe('listing-uuid-1234');
      expect(mockFavoriteRepo.save).toHaveBeenCalled();
    });

    it('should return existing favorite if already favorited', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);
      mockFavoriteRepo.findOne.mockResolvedValue(mockFavorite);

      const result = await service.add('listing-uuid-1234', 'user-uuid-1234');

      expect(result).toBeDefined();
      expect(result.id).toBe(mockFavorite.id);
      expect(mockFavoriteRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent listing', async () => {
      mockListingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.add('non-existent-id', 'user-uuid-1234'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a favorite successfully', async () => {
      mockFavoriteRepo.findOne.mockResolvedValue(mockFavorite);
      mockFavoriteRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove('listing-uuid-1234', 'user-uuid-1234');

      expect(mockFavoriteRepo.delete).toHaveBeenCalledWith(mockFavorite.id);
    });

    it('should throw NotFoundException if favorite not found', async () => {
      mockFavoriteRepo.findOne.mockResolvedValue(null);

      await expect(
        service.remove('listing-uuid-1234', 'user-uuid-1234'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserFavorites', () => {
    it('should return paginated user favorites', async () => {
      const favoriteWithListing = {
        ...mockFavorite,
        listing: mockListing,
      };

      mockFavoriteRepo.findAndCount.mockResolvedValue([[favoriteWithListing], 1]);

      const result = await service.getUserFavorites('user-uuid-1234', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].isFavorited).toBe(true);
      expect(result.meta.total).toBe(1);
    });

    it('should filter out deleted listings', async () => {
      const favoriteWithDeletedListing = {
        ...mockFavorite,
        listing: { ...mockListing, deletedAt: new Date() },
      };

      mockFavoriteRepo.findAndCount.mockResolvedValue([[favoriteWithDeletedListing], 1]);

      const result = await service.getUserFavorites('user-uuid-1234', 1, 20);

      expect(result.data).toHaveLength(0);
    });

    it('should filter out non-active listings', async () => {
      const favoriteWithSoldListing = {
        ...mockFavorite,
        listing: { ...mockListing, status: ListingStatus.SOLD },
      };

      mockFavoriteRepo.findAndCount.mockResolvedValue([[favoriteWithSoldListing], 1]);

      const result = await service.getUserFavorites('user-uuid-1234', 1, 20);

      expect(result.data).toHaveLength(0);
    });

    it('should handle pagination correctly', async () => {
      const favorites = Array(50).fill({
        ...mockFavorite,
        listing: mockListing,
      });

      mockFavoriteRepo.findAndCount.mockResolvedValue([favorites.slice(0, 20), 50]);

      const result = await service.getUserFavorites('user-uuid-1234', 1, 20);

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrev).toBe(false);
    });
  });

  describe('isFavorited', () => {
    it('should return true if favorited', async () => {
      mockFavoriteRepo.findOne.mockResolvedValue(mockFavorite);

      const result = await service.isFavorited('listing-uuid-1234', 'user-uuid-1234');

      expect(result).toBe(true);
    });

    it('should return false if not favorited', async () => {
      mockFavoriteRepo.findOne.mockResolvedValue(null);

      const result = await service.isFavorited('listing-uuid-1234', 'user-uuid-1234');

      expect(result).toBe(false);
    });
  });

  describe('getFavoriteCount', () => {
    it('should return favorite count for a listing', async () => {
      mockFavoriteRepo.count.mockResolvedValue(42);

      const result = await service.getFavoriteCount('listing-uuid-1234');

      expect(result).toBe(42);
      expect(mockFavoriteRepo.count).toHaveBeenCalledWith({
        where: { listingId: 'listing-uuid-1234' },
      });
    });
  });
});
