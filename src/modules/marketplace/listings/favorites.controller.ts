import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator.js';
import { FavoritesService } from './favorites.service.js';

interface JwtPayload {
  sub: string;
  email: string;
}

@ApiTags('Listing Favorites')
@Controller('listings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get('favorites')
  @ApiOperation({ summary: 'Get current user favorites' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Favorites retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserFavorites(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.favoritesService.getUserFavorites(
      user.sub,
      page || 1,
      limit || 20,
    );
    return {
      success: true,
      ...result,
    };
  }

  @Post(':id/favorite')
  @ApiOperation({ summary: 'Toggle favorite status for a listing' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Favorite toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async toggleFavorite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.favoritesService.toggle(id, user.sub);
    return {
      success: true,
      data: result,
    };
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a listing from favorites' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Removed from favorites' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  async removeFavorite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.favoritesService.remove(id, user.sub);
  }

  @Get(':id/favorite/count')
  @ApiOperation({ summary: 'Get favorite count for a listing' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Count retrieved successfully' })
  async getFavoriteCount(@Param('id', ParseUUIDPipe) id: string) {
    const count = await this.favoritesService.getFavoriteCount(id);
    return {
      success: true,
      data: { count },
    };
  }
}
