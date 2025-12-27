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
import { PartsService } from './parts.service.js';
import { CreatePartDto } from './dto/create-part.dto.js';
import { UpdatePartDto } from './dto/update-part.dto.js';
import {
  PartQueryDto,
  PartSearchDto,
  CompatibilitySearchDto,
} from './dto/part-query.dto.js';

interface JwtPayload {
  sub: string;
  email: string;
}

@ApiTags('Parts')
@Controller('parts')
export class PartsController {
  constructor(private readonly partsService: PartsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new part listing' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Part created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePartDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const part = await this.partsService.create(user.sub, dto, files);
    return {
      success: true,
      data: part,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all parts with filters' })
  @ApiResponse({ status: 200, description: 'Parts retrieved successfully' })
  async findAll(@Query() query: PartQueryDto) {
    const result = await this.partsService.findAll(query);
    return {
      success: true,
      ...result,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search parts by keyword' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async search(@Query() query: PartSearchDto) {
    const result = await this.partsService.search(query);
    return {
      success: true,
      ...result,
    };
  }

  @Get('compatible')
  @ApiOperation({ summary: 'Search parts by motorcycle model compatibility' })
  @ApiResponse({ status: 200, description: 'Compatible parts retrieved' })
  async searchByCompatibility(@Query() query: CompatibilitySearchDto) {
    const result = await this.partsService.searchByCompatibility(query);
    return {
      success: true,
      ...result,
    };
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular parts' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Popular parts retrieved' })
  async getPopular(@Query('limit') limit?: number) {
    const parts = await this.partsService.getPopular(limit);
    return {
      success: true,
      data: parts,
    };
  }

  @Get('user/:userId')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: "Get user's parts" })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User parts retrieved' })
  async getByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: PartQueryDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.partsService.getByUser(userId, query, user?.sub);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single part' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Part retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Part not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    // Increment views asynchronously
    this.partsService.incrementViews(id);

    const part = await this.partsService.findOne(id);
    return {
      success: true,
      data: part,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a part' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Part updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Part not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePartDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const part = await this.partsService.update(id, user.sub, dto, files);
    return {
      success: true,
      data: part,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a part' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Part deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Part not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.partsService.delete(id, user.sub);
  }

  @Post(':id/sold')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark part as sold' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Part marked as sold' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Part not found' })
  async markAsSold(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const part = await this.partsService.markAsSold(id, user.sub);
    return {
      success: true,
      data: part,
    };
  }
}
