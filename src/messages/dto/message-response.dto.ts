import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageDirection } from '../../common/enums/message-direction.enum';
import { MessageType } from '../../common/enums/message-type.enum';
import { SenderType } from '../../common/enums/sender-type.enum';

export class MessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  businessId: string;

  @ApiProperty()
  conversationId: string;

  @ApiProperty({ enum: SenderType })
  senderType: SenderType;

  @ApiProperty({ enum: MessageDirection })
  direction: MessageDirection;

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: MessageType })
  messageType: MessageType;

  @ApiPropertyOptional({ nullable: true })
  externalMessageId: string | null;

  @ApiPropertyOptional({ nullable: true })
  sentAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

