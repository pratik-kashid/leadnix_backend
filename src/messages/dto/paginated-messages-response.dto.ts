import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from './message-response.dto';

export class PaginatedMessagesResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  items: MessageResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

