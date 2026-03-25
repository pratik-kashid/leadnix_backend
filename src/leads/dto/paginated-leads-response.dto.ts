import { ApiProperty } from '@nestjs/swagger';
import { LeadResponseDto } from './lead-response.dto';

export class PaginatedLeadsResponseDto {
  @ApiProperty({ type: [LeadResponseDto] })
  items: LeadResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
