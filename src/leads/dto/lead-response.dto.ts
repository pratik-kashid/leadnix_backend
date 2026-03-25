import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadPriority } from '../../common/enums/lead-priority.enum';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { ContactResponseDto } from './contact-response.dto';

export class LeadResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  businessId: string;

  @ApiProperty()
  contactId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  source: string;

  @ApiProperty({ enum: LeadStatus })
  status: LeadStatus;

  @ApiProperty({ enum: LeadPriority })
  priority: LeadPriority;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ nullable: true })
  assignedToUserId: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastMessageAt: Date | null;

  @ApiProperty({ type: ContactResponseDto })
  contact: ContactResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
