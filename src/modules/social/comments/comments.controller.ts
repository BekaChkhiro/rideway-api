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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard.js';
import { OptionalAuthGuard } from '@modules/auth/guards/optional-auth.guard.js';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';
import { CommentQueryDto } from './dto/comment-query.dto.js';

interface JwtPayload {
  sub: string;
  email: string;
}

@ApiTags('Comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:postId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiParam({ name: 'postId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.commentsService.create(user.sub, postId, dto);
    return {
      success: true,
      data: comment,
    };
  }

  @Get('posts/:postId/comments')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get comments for a post' })
  @ApiParam({ name: 'postId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  async findByPost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: CommentQueryDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.commentsService.findByPost(
      postId,
      query,
      user?.sub,
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get('comments/:id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get a single comment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Comment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const comment = await this.commentsService.findOne(id, user?.sub);
    return {
      success: true,
      data: comment,
    };
  }

  @Get('comments/:id/replies')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get replies to a comment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Replies retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async findReplies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CommentQueryDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.commentsService.findReplies(id, query, user?.sub);
    return {
      success: true,
      ...result,
    };
  }

  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a comment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCommentDto,
  ) {
    const comment = await this.commentsService.update(id, user.sub, dto);
    return {
      success: true,
      data: comment,
    };
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.commentsService.delete(id, user.sub);
  }

  @Post('comments/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like/unlike a comment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Like toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.commentsService.like(id, user.sub);
    return {
      success: true,
      data: result,
    };
  }
}
