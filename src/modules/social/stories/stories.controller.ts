import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard.js';
import { OptionalAuthGuard } from '@modules/auth/guards/optional-auth.guard.js';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator.js';
import { StoriesService } from './stories.service.js';
import { CreateStoryDto } from './dto/create-story.dto.js';

interface JwtPayload {
  sub: string;
  email: string;
}

@ApiTags('Stories')
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('media'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new story' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Story created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or missing media' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const story = await this.storiesService.create(user.sub, dto, file);
    return {
      success: true,
      data: story,
    };
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get stories feed from followed users' })
  @ApiResponse({ status: 200, description: 'Stories feed retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFeed(@CurrentUser() user: JwtPayload) {
    const result = await this.storiesService.getFeedStories(user.sub);
    return {
      success: true,
      data: result,
    };
  }

  @Get('user/:userId')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: "Get user's active stories" })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User stories retrieved' })
  async getUserStories(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const stories = await this.storiesService.findUserStories(
      userId,
      user?.sub,
    );
    return {
      success: true,
      data: stories,
    };
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get a single story' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Story retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Story not found or expired' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const story = await this.storiesService.findOne(id, user?.sub);
    return {
      success: true,
      data: story,
    };
  }

  @Post(':id/view')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark story as viewed' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Story marked as viewed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async markAsViewed(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.storiesService.markAsViewed(id, user.sub);
    return {
      success: true,
      data: result,
    };
  }

  @Get(':id/viewers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get story viewers (owner only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Viewers list retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only owner can view viewers' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getViewers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const viewers = await this.storiesService.getViewers(id, user.sub);
    return {
      success: true,
      data: viewers,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a story' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Story deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.storiesService.delete(id, user.sub);
  }
}
