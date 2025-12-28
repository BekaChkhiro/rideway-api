import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ServicesService } from '../services.service.js';

// Define enums locally to avoid entity import issues
enum ServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

enum ServiceSortBy {
  RATING = 'rating',
  REVIEWS = 'reviews',
  NEWEST = 'newest',
  DISTANCE = 'distance',
}

describe('ServicesService', () => {
  let service: ServicesService;
  let mockServiceRepo: Record<string, Mock>;
  let mockImageRepo: Record<string, Mock>;
  let mockReviewRepo: Record<string, Mock>;
  let mockCategoriesService: Record<string, Mock>;
  let mockQueryBuilder: Record<string, Mock>;
  let mockReviewQueryBuilder: Record<string, Mock>;

  const mockCategory = {
    id: 'category-uuid-1234',
    name: 'Motorcycle Repair',
    slug: 'motorcycle-repair',
  };

  const mockServiceEntity: Partial<Service> = {
    id: 'service-uuid-1234',
    userId: 'user-uuid-1234',
    categoryId: 'category-uuid-1234',
    name: 'Best Moto Shop',
    description: 'Expert motorcycle repairs',
    address: '123 Main St',
    city: 'New York',
    latitude: 40.7128,
    longitude: -74.006,
    phone: '+1234567890',
    ratingAvg: 4.5,
    reviewsCount: 25,
    isVerified: true,
    status: ServiceStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockImage: Partial<ServiceImage> = {
    id: 'image-uuid-1234',
    serviceId: 'service-uuid-1234',
    url: 'https://example.com/image1.jpg',
    isPrimary: true,
    sortOrder: 0,
  };

  const mockReview: Partial<ServiceReview> = {
    id: 'review-uuid-1234',
    serviceId: 'service-uuid-1234',
    userId: 'reviewer-uuid-1234',
    rating: 5,
    comment: 'Excellent service!',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockQueryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };

    mockReviewQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue({ avg: '4.5', count: '10' }),
    };

    mockServiceRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
      update: vi.fn(),
      softDelete: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockImageRepo = {
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockReviewRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
      update: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(mockReviewQueryBuilder),
    };

    mockCategoriesService = {
      findOne: vi.fn().mockResolvedValue(mockCategory),
    };

    service = new ServicesService(
      mockServiceRepo as any,
      mockImageRepo as any,
      mockReviewRepo as any,
      mockCategoriesService as any,
    );
  });

  describe('create', () => {
    it('should create service with images', async () => {
      const dto = {
        categoryId: 'category-uuid-1234',
        name: 'New Moto Shop',
        description: 'Great service',
        imageUrls: [
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
        ],
      };

      mockServiceRepo.create.mockReturnValue({
        ...mockServiceEntity,
        ...dto,
      });
      mockServiceRepo.save.mockResolvedValue({
        ...mockServiceEntity,
        id: 'new-service-id',
      });
      mockServiceRepo.findOne.mockResolvedValue({
        ...mockServiceEntity,
        id: 'new-service-id',
        images: [mockImage],
      });
      mockImageRepo.create.mockImplementation((data) => data);
      mockImageRepo.save.mockResolvedValue([mockImage]);

      const result = await service.create('user-uuid-1234', dto);

      expect(mockCategoriesService.findOne).toHaveBeenCalledWith(
        'category-uuid-1234',
      );
      expect(mockServiceRepo.save).toHaveBeenCalled();
      expect(mockImageRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should set first image as primary', async () => {
      const dto = {
        categoryId: 'category-uuid-1234',
        name: 'Shop',
        imageUrls: ['url1.jpg', 'url2.jpg', 'url3.jpg'],
      };

      mockServiceRepo.create.mockReturnValue(mockServiceEntity);
      mockServiceRepo.save.mockResolvedValue({
        ...mockServiceEntity,
        id: 'new-id',
      });
      mockServiceRepo.findOne.mockResolvedValue(mockServiceEntity);
      mockImageRepo.create.mockImplementation((data) => data);
      mockImageRepo.save.mockResolvedValue([]);

      await service.create('user-uuid-1234', dto);

      const savedImages = mockImageRepo.save.mock.calls[0][0];
      expect(savedImages[0].isPrimary).toBe(true);
      expect(savedImages[0].sortOrder).toBe(0);
      expect(savedImages[1].isPrimary).toBe(false);
      expect(savedImages[1].sortOrder).toBe(1);
      expect(savedImages[2].isPrimary).toBe(false);
      expect(savedImages[2].sortOrder).toBe(2);
    });

    it('should create service without images', async () => {
      const dto = {
        categoryId: 'category-uuid-1234',
        name: 'Simple Shop',
      };

      mockServiceRepo.create.mockReturnValue(mockServiceEntity);
      mockServiceRepo.save.mockResolvedValue(mockServiceEntity);
      mockServiceRepo.findOne.mockResolvedValue(mockServiceEntity);

      await service.create('user-uuid-1234', dto);

      expect(mockImageRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if category not found', async () => {
      mockCategoriesService.findOne.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(
        service.create('user-uuid-1234', {
          categoryId: 'non-existent',
          name: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated services', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [mockServiceEntity],
        1,
      ]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by category', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ categoryId: 'category-uuid-1234' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'service.category_id = :categoryId',
        { categoryId: 'category-uuid-1234' },
      );
    });

    it('should filter by city', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ city: 'New York' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(service.city) LIKE LOWER(:city)',
        { city: '%New York%' },
      );
    });

    it('should filter by verified status', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ verified: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'service.is_verified = true',
      );
    });

    it('should search by name or description', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'motorcycle' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(LOWER(service.name) LIKE LOWER(:search) OR LOWER(service.description) LIKE LOWER(:search))',
        { search: '%motorcycle%' },
      );
    });

    it('should filter by nearby location (radius)', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        latitude: 40.7128,
        longitude: -74.006,
        radius: 10,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('6371 * acos'),
        { lat: 40.7128, lng: -74.006, radius: 10 },
      );
    });

    it('should sort by rating (default)', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: ServiceSortBy.RATING });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'service.rating_avg',
        'DESC',
      );
    });

    it('should sort by reviews count', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: ServiceSortBy.REVIEWS });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'service.reviews_count',
        'DESC',
      );
    });

    it('should sort by newest', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: ServiceSortBy.NEWEST });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'service.created_at',
        'DESC',
      );
    });

    it('should sort by distance when coordinates provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        sortBy: ServiceSortBy.DISTANCE,
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('6371 * acos'),
        'distance',
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('distance', 'ASC');
    });

    it('should mark isOwner for current user', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [{ ...mockServiceEntity }],
        1,
      ]);

      const result = await service.findAll({}, 'user-uuid-1234');

      expect(result.data[0].isOwner).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return service by id', async () => {
      mockServiceRepo.findOne.mockResolvedValue(mockServiceEntity);

      const result = await service.findOne('service-uuid-1234');

      expect(result.id).toBe('service-uuid-1234');
    });

    it('should throw NotFoundException if service not found', async () => {
      mockServiceRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should mark isOwner for current user', async () => {
      mockServiceRepo.findOne.mockResolvedValue({ ...mockServiceEntity });

      const result = await service.findOne(
        'service-uuid-1234',
        'user-uuid-1234',
      );

      expect(result.isOwner).toBe(true);
    });
  });

  describe('update', () => {
    it('should update service', async () => {
      mockServiceRepo.findOne.mockResolvedValue({ ...mockServiceEntity });

      const result = await service.update(
        'service-uuid-1234',
        'user-uuid-1234',
        {
          name: 'Updated Name',
        },
      );

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-uuid-1234', {
        name: 'Updated Name',
      });
      expect(result).toBeDefined();
    });

    it('should update images when provided', async () => {
      mockServiceRepo.findOne.mockResolvedValue({ ...mockServiceEntity });
      mockImageRepo.create.mockImplementation((data) => data);

      await service.update('service-uuid-1234', 'user-uuid-1234', {
        imageUrls: ['new-url1.jpg', 'new-url2.jpg'],
      });

      expect(mockImageRepo.delete).toHaveBeenCalledWith({
        serviceId: 'service-uuid-1234',
      });
      expect(mockImageRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockServiceRepo.findOne.mockResolvedValue(mockServiceEntity);

      await expect(
        service.update('service-uuid-1234', 'other-user', { name: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should soft delete service', async () => {
      mockServiceRepo.findOne.mockResolvedValue({ ...mockServiceEntity });

      await service.delete('service-uuid-1234', 'user-uuid-1234');

      expect(mockServiceRepo.softDelete).toHaveBeenCalledWith(
        'service-uuid-1234',
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockServiceRepo.findOne.mockResolvedValue(mockServiceEntity);

      await expect(
        service.delete('service-uuid-1234', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verify', () => {
    it('should toggle verified status', async () => {
      mockServiceRepo.findOne.mockResolvedValue({
        ...mockServiceEntity,
        isVerified: false,
      });

      await service.verify('service-uuid-1234');

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-uuid-1234', {
        isVerified: true,
      });
    });

    it('should unverify a verified service', async () => {
      mockServiceRepo.findOne.mockResolvedValue({
        ...mockServiceEntity,
        isVerified: true,
      });

      await service.verify('service-uuid-1234');

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-uuid-1234', {
        isVerified: false,
      });
    });
  });

  describe('getByUser', () => {
    it('should return paginated services by user', async () => {
      mockServiceRepo.findAndCount.mockResolvedValue([[mockServiceEntity], 1]);

      const result = await service.getByUser('user-uuid-1234', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('createReview', () => {
    it('should create a review', async () => {
      mockServiceRepo.findOne.mockResolvedValue({
        ...mockServiceEntity,
        userId: 'owner-uuid', // Different from reviewer
      });
      mockReviewRepo.findOne.mockResolvedValueOnce(null); // No existing review
      mockReviewRepo.create.mockReturnValue(mockReview);
      mockReviewRepo.save.mockResolvedValue({
        ...mockReview,
        id: 'new-review-id',
      });
      mockReviewRepo.findOne.mockResolvedValue({
        ...mockReview,
        id: 'new-review-id',
      });

      const result = await service.createReview(
        'service-uuid-1234',
        'reviewer-uuid-1234',
        { rating: 5, comment: 'Great!' },
      );

      expect(mockReviewRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should update service rating after review', async () => {
      mockServiceRepo.findOne.mockResolvedValue({
        ...mockServiceEntity,
        userId: 'owner-uuid',
      });
      mockReviewRepo.findOne
        .mockResolvedValueOnce(null) // No existing review
        .mockResolvedValue(mockReview); // After save
      mockReviewRepo.create.mockReturnValue(mockReview);
      mockReviewRepo.save.mockResolvedValue(mockReview);
      mockReviewQueryBuilder.getRawOne.mockResolvedValue({
        avg: '4.8',
        count: '26',
      });

      await service.createReview('service-uuid-1234', 'reviewer-uuid-1234', {
        rating: 5,
      });

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-uuid-1234', {
        ratingAvg: 4.8,
        reviewsCount: 26,
      });
    });

    it('should throw ForbiddenException if reviewing own service', async () => {
      mockServiceRepo.findOne.mockResolvedValue(mockServiceEntity);

      await expect(
        service.createReview('service-uuid-1234', 'user-uuid-1234', {
          rating: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if already reviewed', async () => {
      mockServiceRepo.findOne.mockResolvedValue({
        ...mockServiceEntity,
        userId: 'owner-uuid',
      });
      mockReviewRepo.findOne.mockResolvedValue(mockReview);

      await expect(
        service.createReview('service-uuid-1234', 'reviewer-uuid-1234', {
          rating: 5,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findReviews', () => {
    it('should return paginated reviews for service', async () => {
      mockReviewRepo.findAndCount.mockResolvedValue([[mockReview], 1]);

      const result = await service.findReviews('service-uuid-1234', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should mark isOwner for current user', async () => {
      mockReviewRepo.findAndCount.mockResolvedValue([[{ ...mockReview }], 1]);

      const result = await service.findReviews(
        'service-uuid-1234',
        1,
        20,
        'reviewer-uuid-1234',
      );

      expect(result.data[0].isOwner).toBe(true);
    });
  });

  describe('updateReview', () => {
    it('should update review', async () => {
      mockReviewRepo.findOne.mockResolvedValue({ ...mockReview });

      await service.updateReview('review-uuid-1234', 'reviewer-uuid-1234', {
        comment: 'Updated comment',
      });

      expect(mockReviewRepo.update).toHaveBeenCalledWith('review-uuid-1234', {
        comment: 'Updated comment',
      });
    });

    it('should update service rating when rating changed', async () => {
      mockReviewRepo.findOne.mockResolvedValue({ ...mockReview });
      mockReviewQueryBuilder.getRawOne.mockResolvedValue({
        avg: '4.2',
        count: '25',
      });

      await service.updateReview('review-uuid-1234', 'reviewer-uuid-1234', {
        rating: 4,
      });

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-uuid-1234', {
        ratingAvg: 4.2,
        reviewsCount: 25,
      });
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockReviewRepo.findOne.mockResolvedValue(mockReview);

      await expect(
        service.updateReview('review-uuid-1234', 'other-user', { rating: 3 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteReview', () => {
    it('should delete review', async () => {
      mockReviewRepo.findOne.mockResolvedValue({ ...mockReview });

      await service.deleteReview('review-uuid-1234', 'reviewer-uuid-1234');

      expect(mockReviewRepo.delete).toHaveBeenCalledWith('review-uuid-1234');
    });

    it('should update service rating after deletion', async () => {
      mockReviewRepo.findOne.mockResolvedValue({ ...mockReview });
      mockReviewQueryBuilder.getRawOne.mockResolvedValue({
        avg: '4.4',
        count: '24',
      });

      await service.deleteReview('review-uuid-1234', 'reviewer-uuid-1234');

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-uuid-1234', {
        ratingAvg: 4.4,
        reviewsCount: 24,
      });
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockReviewRepo.findOne.mockResolvedValue(mockReview);

      await expect(
        service.deleteReview('review-uuid-1234', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rating calculation', () => {
    it('should calculate correct average from reviews', async () => {
      mockServiceRepo.findOne.mockResolvedValue({
        ...mockServiceEntity,
        userId: 'owner-uuid',
      });
      mockReviewRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mockReview);
      mockReviewRepo.create.mockReturnValue(mockReview);
      mockReviewRepo.save.mockResolvedValue(mockReview);

      // Simulate 5 reviews: 5, 5, 4, 4, 3 = 21/5 = 4.2
      mockReviewQueryBuilder.getRawOne.mockResolvedValue({
        avg: '4.2',
        count: '5',
      });

      await service.createReview('service-uuid-1234', 'reviewer-uuid-1234', {
        rating: 5,
      });

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-uuid-1234', {
        ratingAvg: 4.2,
        reviewsCount: 5,
      });
    });

    it('should handle zero reviews (set rating to 0)', async () => {
      mockReviewRepo.findOne.mockResolvedValue({ ...mockReview });
      mockReviewQueryBuilder.getRawOne.mockResolvedValue({
        avg: null,
        count: '0',
      });

      await service.deleteReview('review-uuid-1234', 'reviewer-uuid-1234');

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-uuid-1234', {
        ratingAvg: 0,
        reviewsCount: 0,
      });
    });

    it('should recalculate rating on review update', async () => {
      mockReviewRepo.findOne.mockResolvedValue({ ...mockReview });
      mockReviewQueryBuilder.getRawOne.mockResolvedValue({
        avg: '3.8',
        count: '10',
      });

      await service.updateReview('review-uuid-1234', 'reviewer-uuid-1234', {
        rating: 2, // Changed from 5 to 2
      });

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-uuid-1234', {
        ratingAvg: 3.8,
        reviewsCount: 10,
      });
    });
  });
});
