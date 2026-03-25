import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SuggestReplyDto {
  @ApiPropertyOptional({ example: 'warm' })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({ example: 'book a discovery call' })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;
}
