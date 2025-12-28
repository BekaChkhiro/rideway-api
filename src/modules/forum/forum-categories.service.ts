import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '@redis/redis.service.js';
import { ForumCategory } from './entities/forum-category.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

@Injectable()
export class ForumCategoriesService {
  private readonly CACHE_KEY = 'forum:categories';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    @InjectRepository(ForumCategory)
    private readonly categoryRepository: Repository<ForumCategory>,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateCategoryDto): Promise<ForumCategory> {
    // Check slug uniqueness
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

  async findAll(): Promise<ForumCategory[]> {
    // Try cache first
    const cached = await this.redisService.get(this.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as ForumCategory[];
    }

    const categories = await this.categoryRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    // Cache for 1 hour
    await this.redisService.set(
      this.CACHE_KEY,
      JSON.stringify(categories),
      this.CACHE_TTL,
    );

    return categories;
  }

  async findOne(id: string): Promise<ForumCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findBySlug(slug: string): Promise<ForumCategory> {
    const category = await this.categoryRepository.findOne({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    dto: Partial<CreateCategoryDto>,
  ): Promise<ForumCategory> {
    const category = await this.findOne(id);

    // Check slug uniqueness if changing
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
    await this.findOne(id);
    await this.categoryRepository.delete(id);
    await this.invalidateCache();
  }

  async incrementThreadsCount(id: string): Promise<void> {
    await this.categoryRepository.increment({ id }, 'threadsCount', 1);
    await this.invalidateCache();
  }

  async decrementThreadsCount(id: string): Promise<void> {
    await this.categoryRepository.decrement({ id }, 'threadsCount', 1);
    await this.invalidateCache();
  }

  private async invalidateCache(): Promise<void> {
    await this.redisService.del(this.CACHE_KEY);
  }
}
