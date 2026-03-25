import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { ContactsService } from '../contacts/contacts.service';
import { TeamMembersService } from '../team-members/team-members.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { LeadPriority } from '../common/enums/lead-priority.enum';
import { LeadStatus } from '../common/enums/lead-status.enum';
import { LeadResponseDto } from './dto/lead-response.dto';
import { PaginatedLeadsResponseDto } from './dto/paginated-leads-response.dto';
import { Contact } from '../contacts/entities/contact.entity';
import { AiQueue } from '../queues/ai.queue';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    private readonly contactsService: ContactsService,
    private readonly teamMembersService: TeamMembersService,
    private readonly dataSource: DataSource,
    private readonly aiQueue: AiQueue,
  ) {}

  private getRepository(manager?: EntityManager): Repository<Lead> {
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

  async create(userId: string, dto: CreateLeadDto): Promise<LeadResponseDto> {
    const lead = await this.dataSource.transaction(async (manager) => {
      const businessIds = await this.getAccessibleBusinessIds(userId, manager);
      const businessId = businessIds[0];

      const reusableContact = await this.contactsService.findReusableByEmailOrPhone(
        businessId,
        dto.contactEmail ?? null,
        dto.contactPhone ?? null,
        manager,
      );

      const contact =
        reusableContact ??
        (await this.contactsService.create(
          {
            businessId,
            name: dto.contactName,
            phone: dto.contactPhone ?? null,
            email: dto.contactEmail ?? null,
            socialHandle: dto.socialHandle ?? null,
            source: dto.contactSource ?? dto.source,
          },
          manager,
        ));

      const leadRepository = this.getRepository(manager);
      const lead = leadRepository.create({
        businessId,
        contactId: contact.id,
        title: dto.title,
        source: dto.source,
        status: LeadStatus.NEW,
        priority: dto.priority ?? LeadPriority.MEDIUM,
        notes: dto.notes ?? null,
        assignedToUserId: dto.assignedToUserId ?? null,
        lastMessageAt: dto.lastMessageAt ? new Date(dto.lastMessageAt) : null,
      });

      return leadRepository.save(lead);
    });

    void this.enqueueLeadAiJobs(lead.id, lead.businessId).catch((error) => {
      this.logger.warn(`Could not enqueue AI jobs for lead ${lead.id}: ${error instanceof Error ? error.message : String(error)}`);
    });

    return this.toResponse(
      await this.getRepository().findOneOrFail({
        where: { id: lead.id },
        relations: { contact: true },
      }),
    );
  }

  async findAll(userId: string, query: QueryLeadsDto): Promise<PaginatedLeadsResponseDto> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const qb = this.getRepository()
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.contact', 'contact')
      .where('lead.businessId IN (:...businessIds)', { businessIds });

    if (query.status) {
      qb.andWhere('lead.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(lead.title ILIKE :search OR lead.source ILIKE :search OR lead.notes ILIKE :search OR contact.name ILIKE :search OR contact.email ILIKE :search OR contact.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('lead.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  async findOne(userId: string, leadId: string): Promise<LeadResponseDto> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const lead = await this.getRepository().findOne({
      where: { id: leadId, businessId: In(businessIds) },
      relations: { contact: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.toResponse(lead);
  }

  async updateStatus(userId: string, leadId: string, dto: UpdateLeadStatusDto): Promise<LeadResponseDto> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const lead = await this.getRepository().findOne({
      where: { id: leadId, businessId: In(businessIds) },
      relations: { contact: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    lead.status = dto.status;
    const savedLead = await this.getRepository().save(lead);

    return this.toResponse(savedLead);
  }

  private toResponse(lead: Lead & { contact: Contact }): LeadResponseDto {
    return {
      id: lead.id,
      businessId: lead.businessId,
      contactId: lead.contactId,
      title: lead.title,
      source: lead.source,
      status: lead.status,
      priority: lead.priority,
      notes: lead.notes,
      assignedToUserId: lead.assignedToUserId,
      lastMessageAt: lead.lastMessageAt,
      contact: {
        id: lead.contact.id,
        businessId: lead.contact.businessId,
        name: lead.contact.name,
        phone: lead.contact.phone,
        email: lead.contact.email,
        socialHandle: lead.contact.socialHandle,
        source: lead.contact.source,
        createdAt: lead.contact.createdAt,
        updatedAt: lead.contact.updatedAt,
      },
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }

  private async enqueueLeadAiJobs(businessId: string, leadId: string): Promise<void> {
    await Promise.all([
      this.aiQueue.enqueueSummarizeLead({ leadId, businessId }),
      this.aiQueue.enqueueScorePriority({ leadId, businessId }),
    ]);
  }
}
