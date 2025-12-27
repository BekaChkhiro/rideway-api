import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  IsNumber,
  IsEmail,
  IsUrl,
  IsObject,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class WorkingHoursDto {
  @IsString()
  open!: string;

  @IsString()
  close!: string;
}

class WeeklyWorkingHoursDto {
  @IsOptional()
  @IsObject()
  mon?: WorkingHoursDto;

  @IsOptional()
  @IsObject()
  tue?: WorkingHoursDto;

  @IsOptional()
  @IsObject()
  wed?: WorkingHoursDto;

  @IsOptional()
  @IsObject()
  thu?: WorkingHoursDto;

  @IsOptional()
  @IsObject()
  fri?: WorkingHoursDto;

  @IsOptional()
  @IsObject()
  sat?: WorkingHoursDto;

  @IsOptional()
  @IsObject()
  sun?: WorkingHoursDto;
}

export class CreateServiceDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Category ID',
  })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({
    example: 'Moto Pro Service',
    description: 'Service/business name',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    example: 'Professional motorcycle repair and maintenance services.',
    description: 'Service description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '123 Main Street, Building 5',
    description: 'Full address',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({
    example: 'Tbilisi',
    description: 'City name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    example: 41.7151,
    description: 'Latitude coordinate',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: 44.8271,
    description: 'Longitude coordinate',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: '+995 599 123456',
    description: 'Contact phone number',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    example: 'contact@motopro.ge',
    description: 'Contact email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'https://motopro.ge',
    description: 'Website URL',
  })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({
    example: {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '18:00' },
      sat: { open: '10:00', close: '15:00' },
    },
    description: 'Working hours by day of week',
  })
  @IsOptional()
  @IsObject()
  workingHours?: WeeklyWorkingHoursDto;

  @ApiPropertyOptional({
    description: 'Array of image URLs',
    example: ['https://r2.example.com/services/image1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
