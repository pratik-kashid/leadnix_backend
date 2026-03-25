import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChannelType } from '../../common/enums/channel-type.enum';
import { MessageResponseDto } from '../../messages/dto/message-response.dto';

export class ConversationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  businessId: string;

  @ApiProperty()
  leadId: string;

  @ApiProperty({ enum: ChannelType })
  channelType: ChannelType;

  @ApiPropertyOptional({ nullable: true })
  externalThreadId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [MessageResponseDto] })
  messages?: MessageResponseDto[];
}

