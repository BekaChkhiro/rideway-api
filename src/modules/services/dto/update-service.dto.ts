import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto.js';

export class UpdateServiceDto extends PartialType(
  OmitType(CreateServiceDto, ['categoryId'] as const),
) {}
