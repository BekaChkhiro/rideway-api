import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  OptionalAuthGuard,
  CurrentUser,
} from '@modules/auth/index.js';
import { ServicesService } from './services.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { ServiceQueryDto } from './dto/service-query.dto.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { Service } from './entities/service.entity.js';
import { ServiceReview } from './entities/service-review.entity.js';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new service listing' })
  @ApiResponse({
    status: 201,
    description: 'Service created successfully',
    type: Service,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateServiceDto,
  ): Promise<Service> {
    return this.servicesService.create(userId, dto);
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get all services with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of services',
  })
  async findAll(
    @Query() query: ServiceQueryDto,
    @CurrentUser('id') userId?: string,
  ): Promise<PaginatedResult<Service>> {
    return this.servicesService.findAll(query, userId);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get service by ID' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({
    status: 200,
    description: 'Service details',
    type: Service,
  })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
  ): Promise<Service> {
    return this.servicesService.findOne(id, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a service' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({
    status: 200,
    description: 'Service updated successfully',
    type: Service,
  })
  @ApiResponse({ status: 403, description: 'Not authorized to edit' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<Service> {
    return this.servicesService.update(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a service' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({ status: 200, description: 'Service deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.servicesService.delete(id, userId);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle verification status (admin only)' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({
    status: 200,
    description: 'Verification status toggled',
    type: Service,
  })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async verify(@Param('id', ParseUUIDPipe) id: string): Promise<Service> {
    return this.servicesService.verify(id);
  }

  @Get('user/:userId')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get services by user ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of user services',
  })
  async getByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<PaginatedResult<Service>> {
    return this.servicesService.getByUser(userId, page, limit);
  }

  // Review endpoints
  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review for a service' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
    type: ServiceReview,
  })
  @ApiResponse({ status: 403, description: 'Cannot review your own service' })
  @ApiResponse({ status: 409, description: 'Already reviewed' })
  async createReview(
    @Param('id', ParseUUIDPipe) serviceId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ServiceReview> {
    return this.servicesService.createReview(serviceId, userId, dto);
  }

  @Get(':id/reviews')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get reviews for a service' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of reviews',
  })
  async findReviews(
    @Param('id', ParseUUIDPipe) serviceId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @CurrentUser('id') userId?: string,
  ): Promise<PaginatedResult<ServiceReview>> {
    return this.servicesService.findReviews(serviceId, page, limit, userId);
  }
}

@ApiTags('Service Reviews')
@Controller('services/reviews')
export class ServiceReviewsController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Review details',
    type: ServiceReview,
  })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
  ): Promise<ServiceReview> {
    return this.servicesService.findReview(id, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully',
    type: ServiceReview,
  })
  @ApiResponse({ status: 403, description: 'Not authorized to edit' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<ServiceReview> {
    return this.servicesService.updateReview(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.servicesService.deleteReview(id, userId);
  }
}
