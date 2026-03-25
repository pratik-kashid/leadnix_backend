import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReplySuggestionResponseDto {
  @ApiProperty()
  aiRunId: string;

  @ApiProperty()
  model: string;

  @ApiPropertyOptional()
  tone?: string;

  @ApiPropertyOptional()
  goal?: string;

  @ApiPropertyOptional()
  language?: string;

  @ApiProperty()
  suggestedReply: string;

  @ApiProperty({ type: [String] })
  reasoning: string[];
}
