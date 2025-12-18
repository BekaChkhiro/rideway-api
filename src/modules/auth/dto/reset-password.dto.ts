import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  code!: string;

  @ApiProperty({
    example: 'NewSecurePass123!',
    description:
      'New password (min 8 chars, must contain uppercase, lowercase, number)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword!: string;
}
