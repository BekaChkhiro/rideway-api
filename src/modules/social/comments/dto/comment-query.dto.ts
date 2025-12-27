import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum CommentSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  POPULAR = 'popular',
}

export class CommentQueryDto {
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
    enum: CommentSortBy,
    description: 'Sort by field',
    default: CommentSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(CommentSortBy)
  sortBy?: CommentSortBy = CommentSortBy.NEWEST;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (comment ID)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
