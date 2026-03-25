import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { MessageDirection } from '../../common/enums/message-direction.enum';
import { MessageType } from '../../common/enums/message-type.enum';
import { SenderType } from '../../common/enums/sender-type.enum';

export class SendMessageDto {
  @ApiPropertyOptional({ example: 'a2f8b6d4-1f1c-4b7d-9d1e-2f2c7a7b1234' })
  @ValidateIf((dto) => !dto.conversationId)
  @IsString()
  @IsNotEmpty()
  leadId?: string;

  @ApiPropertyOptional({ example: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty({ example: 'Thanks for reaching out. Here is the next step.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ enum: SenderType, default: SenderType.AGENT })
  @IsOptional()
  @IsEnum(SenderType)
  senderType?: SenderType;

  @ApiPropertyOptional({ enum: MessageDirection, default: MessageDirection.OUTBOUND })
  @IsOptional()
  @IsEnum(MessageDirection)
  direction?: MessageDirection;

  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiPropertyOptional({ example: 'wa-msg-123' })
  @IsOptional()
  @IsString()
  externalMessageId?: string;
}

