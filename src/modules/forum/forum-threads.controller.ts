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
import { ForumThreadsService } from './forum-threads.service.js';
import { CreateThreadDto } from './dto/create-thread.dto.js';
import { UpdateThreadDto } from './dto/update-thread.dto.js';
import { ThreadQueryDto } from './dto/thread-query.dto.js';
import { CreateReplyDto } from './dto/create-reply.dto.js';
import { UpdateReplyDto } from './dto/update-reply.dto.js';
import { ForumThread } from './entities/forum-thread.entity.js';
import { ThreadReply } from './entities/thread-reply.entity.js';

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

@ApiTags('Forum Threads')
@Controller('forum/threads')
export class ForumThreadsController {
  constructor(private readonly threadsService: ForumThreadsService) {}

  // Thread endpoints
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new thread' })
  @ApiResponse({
    status: 201,
    description: 'Thread created successfully',
    type: ForumThread,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateThreadDto,
  ): Promise<ForumThread> {
    return this.threadsService.create(userId, dto);
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get all threads with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of threads',
  })
  async findAll(
    @Query() query: ThreadQueryDto,
    @CurrentUser('id') userId?: string,
  ): Promise<PaginatedResult<ForumThread>> {
    return this.threadsService.findAll(query, userId);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get thread by ID' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 200,
    description: 'Thread details',
    type: ForumThread,
  })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
  ): Promise<ForumThread> {
    // Increment view count
    await this.threadsService.incrementViews(id);
    return this.threadsService.findOne(id, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a thread' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 200,
    description: 'Thread updated successfully',
    type: ForumThread,
  })
  @ApiResponse({ status: 403, description: 'Not authorized to edit' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateThreadDto,
  ): Promise<ForumThread> {
    return this.threadsService.update(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a thread' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({ status: 200, description: 'Thread deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.threadsService.delete(id, userId);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like/unlike a thread' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 200,
    description: 'Like toggled successfully',
  })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ isLiked: boolean; likesCount: number }> {
    return this.threadsService.like(id, userId);
  }

  @Post(':id/subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe/unsubscribe to thread notifications' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription toggled successfully',
  })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async subscribe(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ isSubscribed: boolean }> {
    return this.threadsService.subscribe(id, userId);
  }

  @Post(':id/pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pin/unpin a thread (admin only)' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 200,
    description: 'Thread pin status toggled',
    type: ForumThread,
  })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async pin(@Param('id', ParseUUIDPipe) id: string): Promise<ForumThread> {
    return this.threadsService.pin(id);
  }

  @Post(':id/lock')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lock/unlock a thread (admin only)' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 200,
    description: 'Thread lock status toggled',
    type: ForumThread,
  })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async lock(@Param('id', ParseUUIDPipe) id: string): Promise<ForumThread> {
    return this.threadsService.lock(id);
  }

  // Reply endpoints
  @Post(':id/replies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a reply to a thread' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 201,
    description: 'Reply created successfully',
    type: ThreadReply,
  })
  @ApiResponse({ status: 400, description: 'Thread is locked' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async createReply(
    @Param('id', ParseUUIDPipe) threadId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReplyDto,
  ): Promise<ThreadReply> {
    return this.threadsService.createReply(threadId, userId, dto);
  }

  @Get(':id/replies')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get replies for a thread' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of replies',
  })
  async findReplies(
    @Param('id', ParseUUIDPipe) threadId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @CurrentUser('id') userId?: string,
  ): Promise<PaginatedResult<ThreadReply>> {
    return this.threadsService.findReplies(threadId, page, limit, userId);
  }
}

@ApiTags('Forum Replies')
@Controller('forum/replies')
export class ForumRepliesController {
  constructor(private readonly threadsService: ForumThreadsService) {}

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get reply by ID' })
  @ApiParam({ name: 'id', description: 'Reply ID' })
  @ApiResponse({
    status: 200,
    description: 'Reply details',
    type: ThreadReply,
  })
  @ApiResponse({ status: 404, description: 'Reply not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
  ): Promise<ThreadReply> {
    return this.threadsService.findReply(id, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a reply' })
  @ApiParam({ name: 'id', description: 'Reply ID' })
  @ApiResponse({
    status: 200,
    description: 'Reply updated successfully',
    type: ThreadReply,
  })
  @ApiResponse({ status: 403, description: 'Not authorized to edit' })
  @ApiResponse({ status: 404, description: 'Reply not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateReplyDto,
  ): Promise<ThreadReply> {
    return this.threadsService.updateReply(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a reply' })
  @ApiParam({ name: 'id', description: 'Reply ID' })
  @ApiResponse({ status: 200, description: 'Reply deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete' })
  @ApiResponse({ status: 404, description: 'Reply not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.threadsService.deleteReply(id, userId);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like/unlike a reply' })
  @ApiParam({ name: 'id', description: 'Reply ID' })
  @ApiResponse({
    status: 200,
    description: 'Like toggled successfully',
  })
  @ApiResponse({ status: 404, description: 'Reply not found' })
  async like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ isLiked: boolean; likesCount: number }> {
    return this.threadsService.likeReply(id, userId);
  }
}
