import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ChannelType } from '../../common/enums/channel-type.enum';

export class CreateConversationDto {
  @ApiProperty({ example: 'a2f8b6d4-1f1c-4b7d-9d1e-2f2c7a7b1234' })
  @IsString()
  @IsNotEmpty()
  leadId: string;

  @ApiProperty({ enum: ChannelType, example: ChannelType.MANUAL })
  @IsEnum(ChannelType)
  channelType: ChannelType;

  @ApiPropertyOptional({ example: 'ig-thread-123' })
  @IsOptional()
  @IsString()
  externalThreadId?: string;
}

