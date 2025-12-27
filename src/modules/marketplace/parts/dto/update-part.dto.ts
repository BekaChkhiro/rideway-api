import { PartialType } from '@nestjs/swagger';
import { CreatePartDto } from './create-part.dto.js';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePartDto extends PartialType(CreatePartDto) {
  @ApiPropertyOptional({
    type: [String],
    description: 'Array of image IDs to delete',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deleteImageIds?: string[];
}
