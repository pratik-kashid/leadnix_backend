import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateIntegrationAutoReplyDto {
  @ApiProperty()
  @IsBoolean()
  autoReplyEnabled: boolean;
}
