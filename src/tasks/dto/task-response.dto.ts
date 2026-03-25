import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../../common/enums/task-status.enum';

export class TaskResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  businessId: string;

  @ApiProperty()
  leadId: string;

  @ApiPropertyOptional({ nullable: true })
  assignedToUserId: string | null;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  dueAt: Date | null;

  @ApiProperty({ enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
