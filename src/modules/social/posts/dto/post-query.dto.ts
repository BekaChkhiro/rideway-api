import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PostSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  POPULAR = 'popular',
  TRENDING = 'trending',
}

export class PostQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: PostSortBy,
    description: 'Sort by field',
    default: PostSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(PostSortBy)
  sortBy?: PostSortBy = PostSortBy.NEWEST;
}

export class FeedQueryDto extends PostQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for infinite scroll (last post ID)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class HashtagQueryDto extends PostQueryDto {
  @ApiPropertyOptional({
    example: 'bikelife',
    description: 'Hashtag name without #',
  })
  @IsOptional()
  @IsString()
  tag?: string;
}

export class TrendingQueryDto {
  @ApiPropertyOptional({
    example: 10,
    description: 'Number of trending hashtags to return',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 24,
    description: 'Hours to look back for trending',
    default: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168) // 1 week
  hours?: number = 24;
}
