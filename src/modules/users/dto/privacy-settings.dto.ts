import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacySettingsDto {
  @IsBoolean()
  @IsOptional()
  appearOffline?: boolean;

  @IsBoolean()
  @IsOptional()
  showLastSeen?: boolean;
}
