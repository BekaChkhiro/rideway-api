import { IsBoolean } from 'class-validator';

export class MuteConversationDto {
  @IsBoolean()
  muted!: boolean;
}
