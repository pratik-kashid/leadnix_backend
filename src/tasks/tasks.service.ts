import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { Lead } from '../leads/entities/lead.entity';
import { TeamMembersService } from '../team-members/team-members.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TaskStatus } from '../common/enums/task-status.enum';
import { PaginatedTasksResponseDto } from './dto/paginated-tasks-response.dto';
import { TaskResponseDto } from './dto/task-response.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    private readonly teamMembersService: TeamMembersService,
    private readonly dataSource: DataSource,
  ) {}

  private getTaskRepository(manager?: EntityManager): Repository<Task> {
    return manager ? manager.getRepository(Task) : this.tasksRepository;
  }

  private getLeadRepository(manager?: EntityManager): Repository<Lead> {
    return manager ? manager.getRepository(Lead) : this.leadsRepository;
  }

  private async getAccessibleBusinessIds(userId: string, manager?: EntityManager): Promise<string[]> {
    const memberships = await this.teamMembersService.findByUserId(userId, manager);
    const businessIds = [...new Set(memberships.map((membership) => membership.businessId))];

    if (!businessIds.length) {
      throw new ForbiddenException('No accessible businesses found');
    }

    return businessIds;
  }

  private async getLeadOrThrow(userId: string, leadId: string, manager?: EntityManager): Promise<Lead> {
    const businessIds = await this.getAccessibleBusinessIds(userId, manager);
    const lead = await this.getLeadRepository(manager).findOne({
      where: { id: leadId, businessId: In(businessIds) },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async create(userId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    const task = await this.dataSource.transaction(async (manager) => {
      const lead = await this.getLeadOrThrow(userId, dto.leadId, manager);
      const repository = this.getTaskRepository(manager);

      const task = repository.create({
        businessId: lead.businessId,
        leadId: lead.id,
        assignedToUserId: dto.assignedToUserId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        status: TaskStatus.OPEN,
      });

      return repository.save(task);
    });

    return this.toResponse(task);
  }

  async findAll(userId: string, query: QueryTasksDto): Promise<PaginatedTasksResponseDto> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const qb = this.getTaskRepository()
      .createQueryBuilder('task')
      .where('task.businessId IN (:...businessIds)', { businessIds });

    if (query.leadId) {
      qb.andWhere('task.leadId = :leadId', { leadId: query.leadId });
    }

    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('(task.title ILIKE :search OR task.description ILIKE :search)', { search: `%${query.search}%` });
    }

    qb.orderBy('task.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  async updateStatus(userId: string, taskId: string, dto: UpdateTaskStatusDto): Promise<TaskResponseDto> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const task = await this.getTaskRepository().findOne({
      where: { id: taskId, businessId: In(businessIds) },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    task.status = dto.status;
    const saved = await this.getTaskRepository().save(task);
    return this.toResponse(saved);
  }

  private toResponse(task: Task): TaskResponseDto {
    return {
      id: task.id,
      businessId: task.businessId,
      leadId: task.leadId,
      assignedToUserId: task.assignedToUserId,
      title: task.title,
      description: task.description,
      dueAt: task.dueAt,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
