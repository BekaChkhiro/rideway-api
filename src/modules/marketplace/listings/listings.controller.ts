import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard.js';
import { OptionalAuthGuard } from '@modules/auth/guards/optional-auth.guard.js';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator.js';
import { ListingsService } from './listings.service.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { ListingQueryDto, ListingSearchDto } from './dto/listing-query.dto.js';

interface JwtPayload {
  sub: string;
  email: string;
}

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new listing' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Listing created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateListingDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const listing = await this.listingsService.create(user.sub, dto, files);
    return {
      success: true,
      data: listing,
    };
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get all listings with filters' })
  @ApiResponse({ status: 200, description: 'Listings retrieved successfully' })
  async findAll(
    @Query() query: ListingQueryDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.listingsService.findAll(query, user?.sub);
    return {
      success: true,
      ...result,
    };
  }

  @Get('search')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Search listings by keyword' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async search(
    @Query() query: ListingSearchDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.listingsService.search(query, user?.sub);
    return {
      success: true,
      ...result,
    };
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular listings' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Popular listings retrieved' })
  async getPopular(@Query('limit') limit?: number) {
    const listings = await this.listingsService.getPopular(limit);
    return {
      success: true,
      data: listings,
    };
  }

  @Get('user/:userId')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: "Get user's listings" })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User listings retrieved' })
  async getByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ListingQueryDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.listingsService.getByUser(
      userId,
      query,
      user?.sub,
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get a single listing' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Listing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    // Increment views asynchronously
    this.listingsService.incrementViews(id);

    const listing = await this.listingsService.findOne(id, user?.sub);
    return {
      success: true,
      data: listing,
    };
  }

  @Get(':id/related')
  @ApiOperation({ summary: 'Get related listings' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Related listings retrieved' })
  async getRelated(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ) {
    const listings = await this.listingsService.getRelated(id, limit);
    return {
      success: true,
      data: listings,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a listing' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Listing updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateListingDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const listing = await this.listingsService.update(id, user.sub, dto, files);
    return {
      success: true,
      data: listing,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a listing' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Listing deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.listingsService.delete(id, user.sub);
  }

  @Post(':id/sold')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark listing as sold' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Listing marked as sold' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async markAsSold(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const listing = await this.listingsService.markAsSold(id, user.sub);
    return {
      success: true,
      data: listing,
    };
  }
}
