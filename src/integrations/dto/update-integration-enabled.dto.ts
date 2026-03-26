import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateIntegrationEnabledDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}
