import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import {
  UpdateProfileDto,
  PaginationQueryDto,
  UserSearchQueryDto,
  UpdatePrivacySettingsDto,
} from './dto/index.js';
import {
  JwtAuthGuard,
  OptionalAuthGuard,
  CurrentUser,
} from '@modules/auth/index.js';
import { GatewayService } from '@modules/gateway/gateway.service.js';
import { User } from '@database/index.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly gatewayService: GatewayService,
  ) {}

  @Get('online-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get online status for multiple users' })
  @ApiResponse({ status: 200, description: 'Online status for users' })
  async getOnlineStatus(
    @Query('userIds') userIds: string,
  ): Promise<Record<string, { isOnline: boolean; lastSeen?: Date }>> {
    const ids = userIds ? userIds.split(',').filter((id) => id.trim()) : [];

    if (ids.length === 0) {
      return {};
    }

    if (ids.length > 100) {
      throw new BadRequestException('Maximum 100 user IDs allowed');
    }

    const statusMap = await this.gatewayService.getOnlineStatusBatch(ids);
    const result: Record<string, { isOnline: boolean; lastSeen?: Date }> = {};

    for (const [userId, info] of statusMap) {
      result[userId] = {
        isOnline: info.isOnline,
        lastSeen: info.lastSeen,
      };
    }

    return result;
  }

  @Get('privacy-settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user privacy settings' })
  @ApiResponse({ status: 200, description: 'Privacy settings' })
  async getPrivacySettings(
    @CurrentUser() user: User,
  ): Promise<{ appearOffline: boolean; showLastSeen: boolean }> {
    const status = await this.gatewayService.getOnlineStatus(user.id);
    return {
      appearOffline: status.appearOffline || false,
      showLastSeen: true,
    };
  }

  @Patch('privacy-settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update privacy settings' })
  @ApiResponse({ status: 200, description: 'Privacy settings updated' })
  async updatePrivacySettings(
    @CurrentUser() user: User,
    @Body() dto: UpdatePrivacySettingsDto,
  ): Promise<{ message: string }> {
    if (dto.appearOffline !== undefined) {
      await this.gatewayService.setAppearOffline(user.id, dto.appearOffline);
    }
    return { message: 'Privacy settings updated' };
  }

  @Get('search')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Search users by username or name' })
  @ApiResponse({ status: 200, description: 'Users found' })
  async searchUsers(
    @Query() query: UserSearchQueryDto,
    @CurrentUser() currentUser: User | null,
  ) {
    return this.usersService.searchUsers(query, currentUser?.id);
  }

  @Get('username/:username')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get user by username' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiParam({ name: 'username', description: 'Username' })
  async getUserByUsername(
    @Param('username') username: string,
    @CurrentUser() currentUser: User | null,
  ) {
    return this.usersService.getUserByUsername(username, currentUser?.id);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get user profile by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User | null,
  ) {
    return this.usersService.getUserById(id, currentUser?.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get(':id/followers')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get user followers' })
  @ApiResponse({ status: 200, description: 'Followers list' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async getFollowers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUser: User | null,
  ) {
    return this.usersService.getFollowers(id, query, currentUser?.id);
  }

  @Get(':id/following')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get users this user is following' })
  @ApiResponse({ status: 200, description: 'Following list' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async getFollowing(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUser: User | null,
  ) {
    return this.usersService.getFollowing(id, query, currentUser?.id);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 201, description: 'User followed' })
  @ApiResponse({ status: 400, description: 'Cannot follow yourself' })
  @ApiResponse({ status: 403, description: 'Cannot follow blocked user' })
  @ApiResponse({ status: 409, description: 'Already following' })
  @ApiParam({ name: 'id', description: 'User ID to follow' })
  async followUser(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.usersService.followUser(user.id, id);
    return { message: 'User followed successfully' };
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 200, description: 'User unfollowed' })
  @ApiResponse({ status: 404, description: 'Not following this user' })
  @ApiParam({ name: 'id', description: 'User ID to unfollow' })
  async unfollowUser(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.usersService.unfollowUser(user.id, id);
    return { message: 'User unfollowed successfully' };
  }

  @Post(':id/block')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Block a user' })
  @ApiResponse({ status: 201, description: 'User blocked' })
  @ApiResponse({ status: 400, description: 'Cannot block yourself' })
  @ApiResponse({ status: 409, description: 'User already blocked' })
  @ApiParam({ name: 'id', description: 'User ID to block' })
  async blockUser(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.usersService.blockUser(user.id, id);
    return { message: 'User blocked successfully' };
  }

  @Delete(':id/block')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiResponse({ status: 200, description: 'User unblocked' })
  @ApiResponse({ status: 404, description: 'User not blocked' })
  @ApiParam({ name: 'id', description: 'User ID to unblock' })
  async unblockUser(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.usersService.unblockUser(user.id, id);
    return { message: 'User unblocked successfully' };
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 413, description: 'File too large' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (_req, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only jpeg, png, and webp images are allowed',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.usersService.uploadAvatar(user.id, file);
  }

  @Delete('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar deleted successfully' })
  @ApiResponse({ status: 400, description: 'No avatar to delete' })
  async deleteAvatar(@CurrentUser() user: User) {
    await this.usersService.deleteAvatar(user.id);
    return { message: 'Avatar deleted successfully' };
  }

  @Post('cover')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Upload user cover image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Cover uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 413, description: 'File too large' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (_req, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only jpeg, png, and webp images are allowed',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadCover(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.usersService.uploadCover(user.id, file);
  }

  @Delete('cover')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete user cover image' })
  @ApiResponse({ status: 200, description: 'Cover deleted successfully' })
  @ApiResponse({ status: 400, description: 'No cover to delete' })
  async deleteCover(@CurrentUser() user: User) {
    await this.usersService.deleteCover(user.id);
    return { message: 'Cover deleted successfully' };
  }
}
