import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  // Global settings
  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  // Granular settings
  @IsBoolean()
  @IsOptional()
  newFollower?: boolean;

  @IsBoolean()
  @IsOptional()
  postLike?: boolean;

  @IsBoolean()
  @IsOptional()
  postComment?: boolean;

  @IsBoolean()
  @IsOptional()
  commentReply?: boolean;

  @IsBoolean()
  @IsOptional()
  newMessage?: boolean;

  @IsBoolean()
  @IsOptional()
  threadReply?: boolean;

  @IsBoolean()
  @IsOptional()
  listingInquiry?: boolean;
}
