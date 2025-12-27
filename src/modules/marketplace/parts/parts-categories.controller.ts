import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard.js';
import { PartsCategoriesService } from './parts-categories.service.js';
import {
  CreatePartsCategoryDto,
  UpdatePartsCategoryDto,
} from './dto/create-parts-category.dto.js';

@ApiTags('Parts Categories')
@Controller('parts/categories')
export class PartsCategoriesController {
  constructor(
    private readonly partsCategoriesService: PartsCategoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all parts categories (nested)' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  async findAll() {
    const categories = await this.partsCategoriesService.findAll();
    return {
      success: true,
      data: categories,
    };
  }

  @Get('flat')
  @ApiOperation({ summary: 'Get all parts categories (flat list)' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  async findAllFlat() {
    const categories = await this.partsCategoriesService.findAllFlat();
    return {
      success: true,
      data: categories,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const category = await this.partsCategoriesService.findOne(id);
    return {
      success: true,
      data: category,
    };
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findBySlug(@Param('slug') slug: string) {
    const category = await this.partsCategoriesService.findBySlug(slug);
    return {
      success: true,
      data: category,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category (admin only)' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async create(@Body() dto: CreatePartsCategoryDto) {
    const category = await this.partsCategoriesService.create(dto);
    return {
      success: true,
      data: category,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartsCategoryDto,
  ) {
    const category = await this.partsCategoriesService.update(id, dto);
    return {
      success: true,
      data: category,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Category deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete category with subcategories',
  })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.partsCategoriesService.delete(id);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder categories (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Categories reordered successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async reorder(@Body() body: { ids: string[] }) {
    await this.partsCategoriesService.reorder(body.ids);
    return {
      success: true,
      message: 'Categories reordered successfully',
    };
  }
}
