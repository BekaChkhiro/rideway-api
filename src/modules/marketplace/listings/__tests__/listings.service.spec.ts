import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ListingsService } from '../listings.service.js';
import { Listing, ListingStatus, ListingCondition } from '../entities/listing.entity.js';
import { ListingImage } from '../entities/listing-image.entity.js';
import { ListingFavorite } from '../entities/listing-favorite.entity.js';
import { ListingSortBy } from '../dto/listing-query.dto.js';

describe('ListingsService', () => {
  let service: ListingsService;
  let mockListingRepo: Record<string, Mock>;
  let mockImageRepo: Record<string, Mock>;
  let mockFavoriteRepo: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;
  let mockMediaService: Record<string, Mock>;

  const mockUser = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
  };

  const mockCategory = {
    id: 'category-uuid-1234',
    name: 'Motorcycles',
    slug: 'motorcycles',
  };

  const mockListing: Partial<Listing> = {
    id: 'listing-uuid-1234',
    userId: 'user-uuid-1234',
    categoryId: 'category-uuid-1234',
    title: 'Honda CBR 600RR',
    description: 'Great condition, low mileage',
    price: 8500,
    currency: 'GEL',
    condition: ListingCondition.USED,
    location: 'Tbilisi',
    status: ListingStatus.ACTIVE,
    viewsCount: 0,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: mockCategory as any,
    images: [],
    user: mockUser as any,
  };

  const mockImage: Partial<ListingImage> = {
    id: 'image-uuid-1234',
    listingId: 'listing-uuid-1234',
    url: 'https://r2.example.com/listings/image1.jpg',
    thumbnailUrl: 'https://r2.example.com/listings/image1_thumb.jpg',
    sortOrder: 0,
  };

  const mockFavorite: Partial<ListingFavorite> = {
    id: 'favorite-uuid-1234',
    listingId: 'listing-uuid-1234',
    userId: 'user-uuid-1234',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockListingRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      increment: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    mockImageRepo = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    };

    mockFavoriteRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
    };

    mockRedisService = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
      getClient: vi.fn().mockReturnValue({
        incr: vi.fn().mockResolvedValue(1),
        getdel: vi.fn(),
      }),
    };

    mockMediaService = {
      uploadImages: vi.fn(),
      deleteImage: vi.fn(),
    };

    service = new ListingsService(
      mockListingRepo as any,
      mockImageRepo as any,
      mockFavoriteRepo as any,
      mockRedisService as any,
      mockMediaService as any,
    );
  });

  describe('create', () => {
    const createDto = {
      categoryId: 'category-uuid-1234',
      title: 'Honda CBR 600RR',
      description: 'Great condition, low mileage',
      price: 8500,
      currency: 'GEL',
      condition: ListingCondition.USED,
      location: 'Tbilisi',
    };

    it('should create a listing successfully', async () => {
      mockListingRepo.create.mockReturnValue(mockListing);
      mockListingRepo.save.mockResolvedValue(mockListing);
      mockListingRepo.findOne.mockResolvedValue(mockListing);

      const result = await service.create('user-uuid-1234', createDto);

      expect(result).toBeDefined();
      expect(result.title).toBe(createDto.title);
      expect(mockListingRepo.create).toHaveBeenCalledWith({
        ...createDto,
        userId: 'user-uuid-1234',
        price: createDto.price,
      });
      expect(mockListingRepo.save).toHaveBeenCalled();
    });

    it('should create a listing with image URLs', async () => {
      const dtoWithImages = {
        ...createDto,
        imageUrls: ['https://r2.example.com/image1.jpg', 'https://r2.example.com/image2.jpg'],
      };

      mockListingRepo.create.mockReturnValue(mockListing);
      mockListingRepo.save.mockResolvedValue(mockListing);
      mockListingRepo.findOne.mockResolvedValue({ ...mockListing, images: [mockImage] });
      mockImageRepo.count.mockResolvedValue(0);
      mockImageRepo.create.mockReturnValue(mockImage);
      mockImageRepo.save.mockResolvedValue([mockImage]);

      const result = await service.create('user-uuid-1234', dtoWithImages);

      expect(result).toBeDefined();
      expect(mockImageRepo.save).toHaveBeenCalled();
    });

    it('should create a listing with uploaded files', async () => {
      const files = [
        { buffer: Buffer.from('test'), mimetype: 'image/jpeg', originalname: 'test.jpg' },
      ] as Express.Multer.File[];

      mockListingRepo.create.mockReturnValue(mockListing);
      mockListingRepo.save.mockResolvedValue(mockListing);
      mockListingRepo.findOne.mockResolvedValue({ ...mockListing, images: [mockImage] });
      mockMediaService.uploadImages.mockResolvedValue([
        { url: 'https://r2.example.com/uploaded.jpg', thumbnailUrl: 'https://r2.example.com/uploaded_thumb.jpg' },
      ]);
      mockImageRepo.create.mockReturnValue(mockImage);
      mockImageRepo.save.mockResolvedValue([mockImage]);

      const result = await service.create('user-uuid-1234', createDto, files);

      expect(result).toBeDefined();
      expect(mockMediaService.uploadImages).toHaveBeenCalledWith(files, 'listings', 'user-uuid-1234');
    });
  });

  describe('findAll', () => {
    it('should return paginated listings', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockListing], 1]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(false);
    });

    it('should filter by category', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockListing], 1]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ page: 1, limit: 20, categoryId: 'category-uuid-1234' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.category_id = :categoryId',
        { categoryId: 'category-uuid-1234' },
      );
    });

    it('should filter by price range', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockListing], 1]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ page: 1, limit: 20, minPrice: 5000, maxPrice: 10000 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('listing.price >= :minPrice', { minPrice: 5000 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('listing.price <= :maxPrice', { maxPrice: 10000 });
    });

    it('should filter by location', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockListing], 1]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ page: 1, limit: 20, location: 'Tbilisi' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.location ILIKE :location',
        { location: '%Tbilisi%' },
      );
    });

    it('should sort by price ascending', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockListing], 1]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ page: 1, limit: 20, sortBy: ListingSortBy.PRICE_ASC });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('listing.price', 'ASC');
    });

    it('should mark favorites for authenticated user', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[{ ...mockListing }], 1]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockFavoriteRepo.find.mockResolvedValue([mockFavorite]);

      const result = await service.findAll({ page: 1, limit: 20 }, 'user-uuid-1234');

      expect(result.data[0].isFavorited).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockListing], 50]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({ page: 2, limit: 20 });

      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrev).toBe(true);
      expect(result.meta.totalPages).toBe(3);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });
  });

  describe('findOne', () => {
    it('should return a listing by ID', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);

      const result = await service.findOne('listing-uuid-1234');

      expect(result).toBeDefined();
      expect(result.id).toBe('listing-uuid-1234');
    });

    it('should throw NotFoundException for non-existent listing', async () => {
      mockListingRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should check favorite status for authenticated user', async () => {
      mockListingRepo.findOne.mockResolvedValue({ ...mockListing });
      mockFavoriteRepo.findOne.mockResolvedValue(mockFavorite);

      const result = await service.findOne('listing-uuid-1234', 'user-uuid-1234');

      expect(result.isFavorited).toBe(true);
    });
  });

  describe('update', () => {
    const updateDto = {
      title: 'Updated Honda CBR 600RR',
      price: 9000,
    };

    it('should update a listing successfully', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);
      mockListingRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('listing-uuid-1234', 'user-uuid-1234', updateDto);

      expect(result).toBeDefined();
      expect(mockListingRepo.update).toHaveBeenCalledWith('listing-uuid-1234', updateDto);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);

      await expect(
        service.update('listing-uuid-1234', 'different-user-id', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should handle image deletions', async () => {
      const dtoWithImageDeletion = {
        ...updateDto,
        deleteImageIds: ['image-uuid-1234'],
      };

      mockListingRepo.findOne.mockResolvedValue({ ...mockListing, images: [mockImage] });
      mockListingRepo.update.mockResolvedValue({ affected: 1 });
      mockImageRepo.find.mockResolvedValue([{ ...mockImage, listing: mockListing }]);
      mockMediaService.deleteImage.mockResolvedValue(undefined);
      mockImageRepo.delete.mockResolvedValue({ affected: 1 });

      await service.update('listing-uuid-1234', 'user-uuid-1234', dtoWithImageDeletion);

      expect(mockMediaService.deleteImage).toHaveBeenCalled();
      expect(mockImageRepo.delete).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a listing successfully', async () => {
      mockListingRepo.findOne.mockResolvedValue({ ...mockListing, images: [] });
      mockListingRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.delete('listing-uuid-1234', 'user-uuid-1234');

      expect(mockListingRepo.softDelete).toHaveBeenCalledWith('listing-uuid-1234');
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);

      await expect(service.delete('listing-uuid-1234', 'different-user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete associated images from R2', async () => {
      mockListingRepo.findOne.mockResolvedValue({ ...mockListing, images: [mockImage] });
      mockListingRepo.softDelete.mockResolvedValue({ affected: 1 });
      mockMediaService.deleteImage.mockResolvedValue(undefined);

      await service.delete('listing-uuid-1234', 'user-uuid-1234');

      expect(mockMediaService.deleteImage).toHaveBeenCalledWith(mockImage.url);
    });
  });

  describe('markAsSold', () => {
    it('should mark listing as sold', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);
      mockListingRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.markAsSold('listing-uuid-1234', 'user-uuid-1234');

      expect(result).toBeDefined();
      expect(mockListingRepo.update).toHaveBeenCalledWith('listing-uuid-1234', {
        status: ListingStatus.SOLD,
      });
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockListingRepo.findOne.mockResolvedValue(mockListing);

      await expect(
        service.markAsSold('listing-uuid-1234', 'different-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('incrementViews', () => {
    it('should increment view count in Redis', async () => {
      const mockIncr = vi.fn().mockResolvedValue(1);
      mockRedisService.getClient.mockReturnValue({ incr: mockIncr });

      await service.incrementViews('listing-uuid-1234');

      expect(mockIncr).toHaveBeenCalledWith('listing:views:listing-uuid-1234');
    });
  });

  describe('search', () => {
    it('should search listings by keyword', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockListing], 1]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.search({ q: 'Honda', page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(listing.title ILIKE :search OR listing.description ILIKE :search)',
        { search: '%Honda%' },
      );
    });
  });

  describe('getPopular', () => {
    it('should return cached popular listings', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify([mockListing]));

      const result = await service.getPopular(10);

      expect(result).toHaveLength(1);
      expect(mockListingRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch and cache popular listings if not cached', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockListingRepo.find.mockResolvedValue([mockListing]);

      const result = await service.getPopular(10);

      expect(result).toHaveLength(1);
      expect(mockListingRepo.find).toHaveBeenCalledWith({
        where: { status: ListingStatus.ACTIVE },
        relations: ['category', 'images'],
        order: { viewsCount: 'DESC' },
        take: 10,
      });
      expect(mockRedisService.set).toHaveBeenCalled();
    });
  });

  describe('getRelated', () => {
    it('should return related listings', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([{ ...mockListing, id: 'other-listing' }]),
      };

      mockListingRepo.findOne.mockResolvedValue(mockListing);
      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getRelated('listing-uuid-1234', 6);

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.category_id = :categoryId',
        { categoryId: 'category-uuid-1234' },
      );
    });
  });

  describe('getByUser', () => {
    it('should return user listings', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockListing], 1]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockFavoriteRepo.find.mockResolvedValue([]);

      const result = await service.getByUser('user-uuid-1234', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
    });

    it('should show all statuses for own profile', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockListing], 1]),
      };

      mockListingRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockFavoriteRepo.find.mockResolvedValue([]);

      await service.getByUser('user-uuid-1234', { page: 1, limit: 20 }, 'user-uuid-1234');

      // Should NOT filter by status when viewing own profile
      const andWhereCalls = mockQueryBuilder.andWhere.mock.calls;
      const statusFilter = andWhereCalls.find(
        (call) => call[0] === 'listing.status = :status',
      );
      expect(statusFilter).toBeUndefined();
    });
  });
});
