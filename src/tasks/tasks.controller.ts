import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { PaginatedTasksResponseDto } from './dto/paginated-tasks-response.dto';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiBody({ type: CreateTaskDto })
  @ApiCreatedResponse({ type: TaskResponseDto })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    return this.tasksService.create(user.sub, dto);
  }

  @Get()
  @ApiOkResponse({ type: PaginatedTasksResponseDto })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryTasksDto): Promise<PaginatedTasksResponseDto> {
    return this.tasksService.findAll(user.sub, query);
  }

  @Patch(':id/status')
  @ApiBody({ type: UpdateTaskStatusDto })
  @ApiOkResponse({ type: TaskResponseDto })
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.updateStatus(user.sub, id, dto);
  }
}
