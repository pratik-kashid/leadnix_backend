import { ApiProperty } from '@nestjs/swagger';
import { LeadPriority } from '../../common/enums/lead-priority.enum';

export class PriorityScoreResponseDto {
  @ApiProperty()
  aiRunId: string;

  @ApiProperty()
  model: string;

  @ApiProperty()
  score: number;

  @ApiProperty({ enum: LeadPriority })
  priority: LeadPriority;

  @ApiProperty({ type: [String] })
  reasons: string[];

  @ApiProperty()
  recommendedAction: string;
}
