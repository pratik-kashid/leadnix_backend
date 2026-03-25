import { ApiProperty } from '@nestjs/swagger';

export class LeadSummaryResponseDto {
  @ApiProperty()
  aiRunId: string;

  @ApiProperty()
  model: string;

  @ApiProperty()
  summary: string;

  @ApiProperty({ type: [String] })
  highlights: string[];

  @ApiProperty({ type: [String] })
  risks: string[];

  @ApiProperty()
  nextAction: string;

  @ApiProperty()
  confidence: number;
}
