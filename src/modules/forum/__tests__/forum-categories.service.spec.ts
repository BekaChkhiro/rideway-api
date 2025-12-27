import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ForumCategoriesService } from '../forum-categories.service.js';
import { ForumCategory } from '../entities/forum-category.entity.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';

describe('ForumCategoriesService', () => {
  let service: ForumCategoriesService;
  let mockCategoryRepo: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;

  const mockCategory: Partial<ForumCategory> = {
    id: 'category-uuid-1234',
    name: 'General Discussion',
    slug: 'general-discussion',
    description: 'Talk about anything motorcycle related',
    icon: 'chat',
    color: '#3B82F6',
    sortOrder: 0,
    threadsCount: 42,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockCategoryRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      increment: vi.fn(),
      decrement: vi.fn(),
    };

    mockRedisService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };

    service = new ForumCategoriesService(
      mockCategoryRepo as any,
      mockRedisService as any,
    );
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const dto: CreateCategoryDto = {
        name: 'Technical Help',
        slug: 'technical-help',
        description: 'Get help with repairs and maintenance',
      };

      mockCategoryRepo.findOne.mockResolvedValue(null);
      mockCategoryRepo.create.mockReturnValue({ ...mockCategory, ...dto });
      mockCategoryRepo.save.mockResolvedValue({ ...mockCategory, ...dto });

      const result = await service.create(dto);

      expect(mockCategoryRepo.create).toHaveBeenCalledWith(dto);
      expect(mockCategoryRepo.save).toHaveBeenCalled();
      expect(mockRedisService.del).toHaveBeenCalled();
      expect(result.name).toBe('Technical Help');
    });

    it('should throw ConflictException if slug already exists', async () => {
      const dto: CreateCategoryDto = {
        name: 'General Discussion',
        slug: 'general-discussion',
      };

      mockCategoryRepo.findOne.mockResolvedValue(mockCategory);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return categories from cache if available', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify([mockCategory]));

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(mockCategoryRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not cached', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockCategoryRepo.find.mockResolvedValue([mockCategory]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(mockCategoryRepo.find).toHaveBeenCalledWith({
        order: { sortOrder: 'ASC', name: 'ASC' },
      });
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'forum:categories',
        JSON.stringify([mockCategory]),
        3600,
      );
    });

    it('should return categories with thread counts', async () => {
      const categoriesWithCounts = [
        { ...mockCategory, threadsCount: 42 },
        { ...mockCategory, id: 'cat-2', threadsCount: 15 },
      ];

      mockRedisService.get.mockResolvedValue(null);
      mockCategoryRepo.find.mockResolvedValue(categoriesWithCounts);

      const result = await service.findAll();

      expect(result[0].threadsCount).toBe(42);
      expect(result[1].threadsCount).toBe(15);
    });
  });

  describe('findOne', () => {
    it('should return category by id', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(mockCategory);

      const result = await service.findOne('category-uuid-1234');

      expect(result.id).toBe('category-uuid-1234');
    });

    it('should throw NotFoundException if category not found', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findBySlug', () => {
    it('should return category by slug', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(mockCategory);

      const result = await service.findBySlug('general-discussion');

      expect(result.slug).toBe('general-discussion');
    });

    it('should throw NotFoundException if category not found', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent-slug')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update category', async () => {
      mockCategoryRepo.findOne
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce({ ...mockCategory, name: 'Updated Name' });

      const result = await service.update('category-uuid-1234', {
        name: 'Updated Name',
      });

      expect(mockCategoryRepo.update).toHaveBeenCalledWith('category-uuid-1234', {
        name: 'Updated Name',
      });
      expect(mockRedisService.del).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });

    it('should throw ConflictException if changing to existing slug', async () => {
      mockCategoryRepo.findOne
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce({ id: 'other-id', slug: 'existing-slug' });

      await expect(
        service.update('category-uuid-1234', { slug: 'existing-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete category and invalidate cache', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(mockCategory);

      await service.delete('category-uuid-1234');

      expect(mockCategoryRepo.delete).toHaveBeenCalledWith('category-uuid-1234');
      expect(mockRedisService.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException if category not found', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('incrementThreadsCount', () => {
    it('should increment threads count and invalidate cache', async () => {
      await service.incrementThreadsCount('category-uuid-1234');

      expect(mockCategoryRepo.increment).toHaveBeenCalledWith(
        { id: 'category-uuid-1234' },
        'threadsCount',
        1,
      );
      expect(mockRedisService.del).toHaveBeenCalled();
    });
  });

  describe('decrementThreadsCount', () => {
    it('should decrement threads count and invalidate cache', async () => {
      await service.decrementThreadsCount('category-uuid-1234');

      expect(mockCategoryRepo.decrement).toHaveBeenCalledWith(
        { id: 'category-uuid-1234' },
        'threadsCount',
        1,
      );
      expect(mockRedisService.del).toHaveBeenCalled();
    });
  });
});
