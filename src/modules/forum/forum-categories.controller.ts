import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/index.js';
import { ForumCategoriesService } from './forum-categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ForumCategory } from './entities/forum-category.entity.js';

@ApiTags('Forum Categories')
@Controller('forum/categories')
export class ForumCategoriesController {
  constructor(private readonly categoriesService: ForumCategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new forum category (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    type: ForumCategory,
  })
  @ApiResponse({ status: 409, description: 'Category slug already exists' })
  async create(@Body() dto: CreateCategoryDto): Promise<ForumCategory> {
    return this.categoriesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all forum categories' })
  @ApiResponse({
    status: 200,
    description: 'List of all categories',
    type: [ForumCategory],
  })
  async findAll(): Promise<ForumCategory[]> {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category details',
    type: ForumCategory,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ForumCategory> {
    return this.categoriesService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiParam({ name: 'slug', description: 'Category slug' })
  @ApiResponse({
    status: 200,
    description: 'Category details',
    type: ForumCategory,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findBySlug(@Param('slug') slug: string): Promise<ForumCategory> {
    return this.categoriesService.findBySlug(slug);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category (admin only)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
    type: ForumCategory,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category slug already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateCategoryDto>,
  ): Promise<ForumCategory> {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category (admin only)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoriesService.delete(id);
  }
}
