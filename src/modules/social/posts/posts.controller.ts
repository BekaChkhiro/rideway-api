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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard.js';
import { OptionalAuthGuard } from '@modules/auth/guards/optional-auth.guard.js';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator.js';
import { PostsService } from './posts.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import {
  PostQueryDto,
  FeedQueryDto,
  TrendingQueryDto,
} from './dto/post-query.dto.js';

interface JwtPayload {
  sub: string;
  email: string;
}

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const post = await this.postsService.create(user.sub, dto, files);
    return {
      success: true,
      data: post,
    };
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized feed' })
  @ApiResponse({ status: 200, description: 'Feed retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFeed(@CurrentUser() user: JwtPayload, @Query() query: FeedQueryDto) {
    const result = await this.postsService.getFeed(user.sub, query);
    return {
      success: true,
      ...result,
    };
  }

  @Get('trending')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get trending posts' })
  @ApiResponse({ status: 200, description: 'Trending posts retrieved' })
  async getTrending(
    @Query() query: PostQueryDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.postsService.getTrendingPosts(query, user?.sub);
    return {
      success: true,
      ...result,
    };
  }

  @Get('trending/hashtags')
  @ApiOperation({ summary: 'Get trending hashtags' })
  @ApiResponse({ status: 200, description: 'Trending hashtags retrieved' })
  async getTrendingHashtags(@Query() query: TrendingQueryDto) {
    const hashtags = await this.postsService.getTrendingHashtags(query);
    return {
      success: true,
      data: hashtags,
    };
  }

  @Get('user/:userId')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: "Get user's posts" })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User posts retrieved' })
  async getUserPosts(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: PostQueryDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.postsService.getUserPosts(
      userId,
      query,
      user?.sub,
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get('hashtag/:tag')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get posts by hashtag' })
  @ApiParam({ name: 'tag', type: 'string', description: 'Hashtag without #' })
  @ApiResponse({ status: 200, description: 'Posts retrieved' })
  async getByHashtag(
    @Param('tag') tag: string,
    @Query() query: PostQueryDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.postsService.getByHashtag(tag, query, user?.sub);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get a single post' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const post = await this.postsService.findOne(id, user?.sub);
    return {
      success: true,
      data: post,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a post' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const post = await this.postsService.update(id, user.sub, dto, files);
    return {
      success: true,
      data: post,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Post deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.postsService.delete(id, user.sub);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like/unlike a post' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Like toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.postsService.like(id, user.sub);
    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Share/repost a post' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Post shared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async share(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { content?: string },
  ) {
    const repost = await this.postsService.share(id, user.sub, body.content);
    return {
      success: true,
      data: repost,
    };
  }
}
