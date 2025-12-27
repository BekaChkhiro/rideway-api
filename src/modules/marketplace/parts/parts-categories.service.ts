import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '@redis/redis.service.js';
import { PartsCategory } from './entities/parts-category.entity.js';
import {
  CreatePartsCategoryDto,
  UpdatePartsCategoryDto,
} from './dto/create-parts-category.dto.js';

@Injectable()
export class PartsCategoriesService {
  private readonly CACHE_KEY = 'parts:categories';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    @InjectRepository(PartsCategory)
    private readonly categoryRepository: Repository<PartsCategory>,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  async create(dto: CreatePartsCategoryDto): Promise<PartsCategory> {
    const existing = await this.categoryRepository.findOne({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Category with this slug already exists');
    }

    const category = this.categoryRepository.create(dto);
    const saved = await this.categoryRepository.save(category);

    await this.invalidateCache();

    return saved;
  }

  async findAll(): Promise<PartsCategory[]> {
    const cached = await this.redisService.get(this.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    const categories = await this.categoryRepository.find({
      relations: ['children'],
      where: { parentId: undefined },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    await this.redisService.set(
      this.CACHE_KEY,
      JSON.stringify(categories),
      this.CACHE_TTL,
    );

    return categories;
  }

  async findAllFlat(): Promise<PartsCategory[]> {
    const cacheKey = `${this.CACHE_KEY}:flat`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const categories = await this.categoryRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    await this.redisService.set(
      cacheKey,
      JSON.stringify(categories),
      this.CACHE_TTL,
    );

    return categories;
  }

  async findOne(id: string): Promise<PartsCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['children', 'parent'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findBySlug(slug: string): Promise<PartsCategory> {
    const category = await this.categoryRepository.findOne({
      where: { slug },
      relations: ['children', 'parent'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    dto: UpdatePartsCategoryDto,
  ): Promise<PartsCategory> {
    const category = await this.findOne(id);

    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.categoryRepository.findOne({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    await this.categoryRepository.update(id, dto);
    await this.invalidateCache();

    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    const category = await this.findOne(id);

    if (category.children && category.children.length > 0) {
      throw new ConflictException(
        'Cannot delete category with subcategories. Delete subcategories first.',
      );
    }

    await this.categoryRepository.delete(id);
    await this.invalidateCache();
  }

  async reorder(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.categoryRepository.update(ids[i], { sortOrder: i });
    }

    await this.invalidateCache();
  }

  private async invalidateCache(): Promise<void> {
    await this.redisService.del(this.CACHE_KEY);
    await this.redisService.del(`${this.CACHE_KEY}:flat`);
  }
}
