import { IsOptional, IsInt, Min, Max, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
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
}

export class UserSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'john',
    description: 'Search query (username or name)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters' })
  q?: string;
}
