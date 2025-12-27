import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PartsService } from '../parts.service.js';
import { Part, PartStatus, PartCondition } from '../entities/part.entity.js';
import { PartImage } from '../entities/part-image.entity.js';
import { PartSortBy } from '../dto/part-query.dto.js';

describe('PartsService', () => {
  let service: PartsService;
  let mockPartRepo: Record<string, Mock>;
  let mockImageRepo: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;
  let mockMediaService: Record<string, Mock>;

  const mockUser = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
  };

  const mockCategory = {
    id: 'category-uuid-1234',
    name: 'Engine Parts',
    slug: 'engine-parts',
  };

  const mockPart: Partial<Part> = {
    id: 'part-uuid-1234',
    userId: 'user-uuid-1234',
    categoryId: 'category-uuid-1234',
    title: 'Honda CBR 600RR Engine Block',
    description: 'Original engine block, low mileage',
    price: 2500,
    currency: 'GEL',
    condition: PartCondition.USED,
    brand: 'Honda',
    partNumber: 'CBR600-EB-001',
    compatibility: ['Honda CBR 600RR 2007-2012', 'Honda CBR 600F 2008-2010'],
    location: 'Tbilisi',
    status: PartStatus.ACTIVE,
    viewsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: mockCategory as any,
    images: [],
    user: mockUser as any,
  };

  const mockImage: Partial<PartImage> = {
    id: 'image-uuid-1234',
    partId: 'part-uuid-1234',
    url: 'https://r2.example.com/parts/image1.jpg',
    thumbnailUrl: 'https://r2.example.com/parts/image1_thumb.jpg',
    sortOrder: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPartRepo = {
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

    service = new PartsService(
      mockPartRepo as any,
      mockImageRepo as any,
      mockRedisService as any,
      mockMediaService as any,
    );
  });

  describe('create', () => {
    const createDto = {
      categoryId: 'category-uuid-1234',
      title: 'Honda CBR 600RR Engine Block',
      description: 'Original engine block, low mileage',
      price: 2500,
      currency: 'GEL',
      condition: PartCondition.USED,
      brand: 'Honda',
      partNumber: 'CBR600-EB-001',
      compatibility: ['Honda CBR 600RR 2007-2012'],
      location: 'Tbilisi',
    };

    it('should create a part successfully', async () => {
      mockPartRepo.create.mockReturnValue(mockPart);
      mockPartRepo.save.mockResolvedValue(mockPart);
      mockPartRepo.findOne.mockResolvedValue(mockPart);

      const result = await service.create('user-uuid-1234', createDto);

      expect(result).toBeDefined();
      expect(result.title).toBe(createDto.title);
      expect(mockPartRepo.create).toHaveBeenCalledWith({
        ...createDto,
        userId: 'user-uuid-1234',
        price: createDto.price,
      });
    });

    it('should create a part with image URLs', async () => {
      const dtoWithImages = {
        ...createDto,
        imageUrls: ['https://r2.example.com/image1.jpg'],
      };

      mockPartRepo.create.mockReturnValue(mockPart);
      mockPartRepo.save.mockResolvedValue(mockPart);
      mockPartRepo.findOne.mockResolvedValue({ ...mockPart, images: [mockImage] });
      mockImageRepo.count.mockResolvedValue(0);
      mockImageRepo.create.mockReturnValue(mockImage);
      mockImageRepo.save.mockResolvedValue([mockImage]);

      const result = await service.create('user-uuid-1234', dtoWithImages);

      expect(result).toBeDefined();
      expect(mockImageRepo.save).toHaveBeenCalled();
    });

    it('should create a part with uploaded files', async () => {
      const files = [
        { buffer: Buffer.from('test'), mimetype: 'image/jpeg', originalname: 'test.jpg' },
      ] as Express.Multer.File[];

      mockPartRepo.create.mockReturnValue(mockPart);
      mockPartRepo.save.mockResolvedValue(mockPart);
      mockPartRepo.findOne.mockResolvedValue({ ...mockPart, images: [mockImage] });
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
    it('should return paginated parts', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by category', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ page: 1, limit: 20, categoryId: 'category-uuid-1234' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'part.category_id = :categoryId',
        { categoryId: 'category-uuid-1234' },
      );
    });

    it('should filter by brand', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ page: 1, limit: 20, brand: 'Honda' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'part.brand ILIKE :brand',
        { brand: '%Honda%' },
      );
    });

    it('should filter by condition', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ page: 1, limit: 20, condition: PartCondition.NEW });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'part.condition = :condition',
        { condition: PartCondition.NEW },
      );
    });

    it('should filter by compatibility', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ page: 1, limit: 20, compatibleWith: 'CBR 600RR' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('jsonb_array_elements_text'),
        { compatibleWith: '%CBR 600RR%' },
      );
    });

    it('should sort by price ascending', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ page: 1, limit: 20, sortBy: PartSortBy.PRICE_ASC });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('part.price', 'ASC');
    });
  });

  describe('findOne', () => {
    it('should return a part by ID', async () => {
      mockPartRepo.findOne.mockResolvedValue(mockPart);

      const result = await service.findOne('part-uuid-1234');

      expect(result).toBeDefined();
      expect(result.id).toBe('part-uuid-1234');
    });

    it('should throw NotFoundException for non-existent part', async () => {
      mockPartRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      title: 'Updated Engine Block',
      price: 2800,
    };

    it('should update a part successfully', async () => {
      mockPartRepo.findOne.mockResolvedValue(mockPart);
      mockPartRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('part-uuid-1234', 'user-uuid-1234', updateDto);

      expect(result).toBeDefined();
      expect(mockPartRepo.update).toHaveBeenCalledWith('part-uuid-1234', updateDto);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPartRepo.findOne.mockResolvedValue(mockPart);

      await expect(
        service.update('part-uuid-1234', 'different-user-id', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should soft delete a part successfully', async () => {
      mockPartRepo.findOne.mockResolvedValue({ ...mockPart, images: [] });
      mockPartRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.delete('part-uuid-1234', 'user-uuid-1234');

      expect(mockPartRepo.softDelete).toHaveBeenCalledWith('part-uuid-1234');
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPartRepo.findOne.mockResolvedValue(mockPart);

      await expect(service.delete('part-uuid-1234', 'different-user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete associated images from R2', async () => {
      mockPartRepo.findOne.mockResolvedValue({ ...mockPart, images: [mockImage] });
      mockPartRepo.softDelete.mockResolvedValue({ affected: 1 });
      mockMediaService.deleteImage.mockResolvedValue(undefined);

      await service.delete('part-uuid-1234', 'user-uuid-1234');

      expect(mockMediaService.deleteImage).toHaveBeenCalledWith(mockImage.url);
    });
  });

  describe('markAsSold', () => {
    it('should mark part as sold', async () => {
      mockPartRepo.findOne.mockResolvedValue(mockPart);
      mockPartRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.markAsSold('part-uuid-1234', 'user-uuid-1234');

      expect(result).toBeDefined();
      expect(mockPartRepo.update).toHaveBeenCalledWith('part-uuid-1234', {
        status: PartStatus.SOLD,
      });
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPartRepo.findOne.mockResolvedValue(mockPart);

      await expect(
        service.markAsSold('part-uuid-1234', 'different-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('incrementViews', () => {
    it('should increment view count in Redis', async () => {
      const mockIncr = vi.fn().mockResolvedValue(1);
      mockRedisService.getClient.mockReturnValue({ incr: mockIncr });

      await service.incrementViews('part-uuid-1234');

      expect(mockIncr).toHaveBeenCalledWith('part:views:part-uuid-1234');
    });
  });

  describe('search', () => {
    it('should search parts by keyword', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.search({ q: 'Engine', page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(part.title ILIKE :search OR part.description ILIKE :search)',
        { search: '%Engine%' },
      );
    });
  });

  describe('searchByCompatibility', () => {
    it('should search parts by motorcycle model', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchByCompatibility({
        model: 'CBR 600RR',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('jsonb_array_elements_text'),
        { model: '%CBR 600RR%' },
      );
    });

    it('should return all active parts if no model specified', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.searchByCompatibility({ page: 1, limit: 20 });

      // Should only filter by status, not by model
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('part.status = :status', {
        status: PartStatus.ACTIVE,
      });
    });
  });

  describe('getPopular', () => {
    it('should return popular parts by views', async () => {
      mockPartRepo.find.mockResolvedValue([mockPart]);

      const result = await service.getPopular(10);

      expect(result).toHaveLength(1);
      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { status: PartStatus.ACTIVE },
        relations: ['category', 'images'],
        order: { viewsCount: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getByUser', () => {
    it('should return user parts', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

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
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getByUser('user-uuid-1234', { page: 1, limit: 20 }, 'user-uuid-1234');

      // Should NOT filter by status when viewing own profile
      const andWhereCalls = mockQueryBuilder.andWhere.mock.calls;
      const statusFilter = andWhereCalls.find(
        (call) => call[0] === 'part.status = :status',
      );
      expect(statusFilter).toBeUndefined();
    });

    it('should filter by active status for other users', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockPart], 1]),
      };

      mockPartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getByUser('user-uuid-1234', { page: 1, limit: 20 }, 'other-user-id');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('part.status = :status', {
        status: PartStatus.ACTIVE,
      });
    });
  });
});
