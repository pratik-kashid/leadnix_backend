import { ApiProperty } from '@nestjs/swagger';
import { TaskResponseDto } from './task-response.dto';

export class PaginatedTasksResponseDto {
  @ApiProperty({ type: [TaskResponseDto] })
  items: TaskResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
