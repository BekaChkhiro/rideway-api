import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsUrl,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'johndoe',
    description: 'Unique username (3-30 chars, alphanumeric and underscores)',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username?: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Full name of the user',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  fullName?: string;

  @ApiPropertyOptional({
    example: 'Motorcycle enthusiast and travel lover',
    description: 'User bio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
  bio?: string;

  @ApiPropertyOptional({
    example: 'Tbilisi, Georgia',
    description: 'User location',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Location must not exceed 100 characters' })
  location?: string;

  @ApiPropertyOptional({
    example: 'https://example.com',
    description: 'User website URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid URL' })
  @MaxLength(255, { message: 'Website URL must not exceed 255 characters' })
  website?: string;

  @ApiPropertyOptional({
    example: '1990-01-15',
    description: 'Date of birth (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Please provide a valid date' })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: 'male',
    description: 'Gender (male, female, other, prefer_not_to_say)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'], {
    message: 'Gender must be one of: male, female, other, prefer_not_to_say',
  })
  gender?: string;
}
