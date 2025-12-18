import { IsString, IsNotEmpty, IsUUID, IsEnum, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OtpType } from '@database/index.js';

export class VerifyOtpDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User ID',
  })
  @IsUUID('4', { message: 'Invalid user ID format' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  code!: string;

  @ApiProperty({
    enum: OtpType,
    example: OtpType.EMAIL_VERIFY,
    description: 'Type of OTP verification',
  })
  @IsEnum(OtpType, { message: 'Invalid OTP type' })
  type!: OtpType;
}
