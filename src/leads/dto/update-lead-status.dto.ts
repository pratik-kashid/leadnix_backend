import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LeadStatus } from '../../common/enums/lead-status.enum';

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  status: LeadStatus;
}
