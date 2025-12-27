import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MessageType } from '../entities/message.entity.js';

export class SendMessageDto {
  @IsString()
  @MaxLength(5000)
  @ValidateIf((o) => !o.mediaUrl)
  content?: string;

  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType = MessageType.TEXT;

  @IsUrl()
  @IsOptional()
  @MaxLength(500)
  mediaUrl?: string;
}

export class SendMessageSocketDto extends SendMessageDto {
  @IsString()
  conversationId!: string;
}
