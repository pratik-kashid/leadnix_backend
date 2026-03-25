import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Business } from '../businesses/entities/business.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { ContactsService } from '../contacts/contacts.service';
import { Lead } from '../leads/entities/lead.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { CreateWebLeadDto } from './dto/create-web-lead.dto';
import { LeadStatus } from '../common/enums/lead-status.enum';
import { LeadPriority } from '../common/enums/lead-priority.enum';
import { ChannelType } from '../common/enums/channel-type.enum';
import { SenderType } from '../common/enums/sender-type.enum';
import { MessageDirection } from '../common/enums/message-direction.enum';
import { MessageType } from '../common/enums/message-type.enum';
import { AiQueue } from '../queues/ai.queue';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly contactsService: ContactsService,
    private readonly aiQueue: AiQueue,
    private readonly dataSource: DataSource,
  ) {}

  async createWebLead(dto: CreateWebLeadDto): Promise<{ leadId: string; conversationId: string }> {
    const result = await this.dataSource.transaction(async (manager) => {
      const business = await manager.getRepository(Business).findOne({
        where: { publicLeadToken: dto.businessToken },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      const contact =
        (await this.contactsService.findReusableByEmailOrPhone(
          business.id,
          dto.email ?? null,
          dto.phone ?? null,
          manager,
        )) ??
        (await this.contactsService.create(
          {
            businessId: business.id,
            name: dto.name,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            socialHandle: null,
            source: dto.source,
          },
          manager,
        ));

      const leadRepository = manager.getRepository(Lead);
      const lead = await leadRepository.save(
        leadRepository.create({
          businessId: business.id,
          contactId: contact.id,
          title: `Website inquiry from ${dto.name}`,
          source: 'WEBSITE_FORM',
          status: LeadStatus.NEW,
          priority: LeadPriority.MEDIUM,
          notes: dto.message,
          assignedToUserId: null,
          lastMessageAt: new Date(),
        }),
      );

      const conversationRepository = manager.getRepository(Conversation);
      const conversation = await conversationRepository.save(
        conversationRepository.create({
          businessId: business.id,
          leadId: lead.id,
          channelType: ChannelType.WEBSITE,
          externalThreadId: null,
        }),
      );

      const messageRepository = manager.getRepository(Message);
      await messageRepository.save(
        messageRepository.create({
          businessId: business.id,
          conversationId: conversation.id,
          senderType: SenderType.CUSTOMER,
          direction: MessageDirection.INBOUND,
          content: dto.message,
          messageType: MessageType.TEXT,
          externalMessageId: null,
          sentAt: new Date(),
        }),
      );

      return {
        leadId: lead.id,
        conversationId: conversation.id,
        businessId: business.id,
      };
    });

    void this.enqueueLeadAiJobs(result.businessId, result.leadId).catch((error) => {
      this.logger.warn(
        `Could not enqueue AI jobs for public lead ${result.leadId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return {
      leadId: result.leadId,
      conversationId: result.conversationId,
    };
  }

  private async enqueueLeadAiJobs(businessId: string, leadId: string): Promise<void> {
    await Promise.all([
      this.aiQueue.enqueueSummarizeLead({ businessId, leadId }),
      this.aiQueue.enqueueScorePriority({ businessId, leadId }),
    ]);
  }
}
