import { IsString, IsOptional, MaxLength, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceCategoryDto {
  @ApiProperty({
    example: 'Repair Shops',
    description: 'Category name',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'repair-shops',
    description: 'URL-friendly slug',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  slug!: string;

  @ApiPropertyOptional({
    example: 'wrench',
    description: 'Icon identifier',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Sort order for display',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
