import { PartialType } from '@nestjs/swagger';
import { CreateListingDto } from './create-listing.dto.js';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateListingDto extends PartialType(CreateListingDto) {
  @ApiPropertyOptional({
    type: [String],
    description: 'Array of image IDs to delete',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deleteImageIds?: string[];
}
