import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { TeamMembersService } from '../team-members/team-members.service';
import { Message } from './entities/message.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Lead } from '../leads/entities/lead.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { PaginatedMessagesResponseDto } from './dto/paginated-messages-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { SenderType } from '../common/enums/sender-type.enum';
import { MessageDirection } from '../common/enums/message-direction.enum';
import { MessageType } from '../common/enums/message-type.enum';
import { ChannelType } from '../common/enums/channel-type.enum';
import { IntegrationsService } from '../integrations/integrations.service';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    private readonly teamMembersService: TeamMembersService,
    private readonly integrationsService: IntegrationsService,
    private readonly dataSource: DataSource,
  ) {}

  private async getAccessibleBusinessIds(userId: string): Promise<string[]> {
    const memberships = await this.teamMembersService.findByUserId(userId);
    const businessIds = [...new Set(memberships.map((membership) => membership.businessId))];

    if (!businessIds.length) {
      throw new ForbiddenException('No accessible businesses found');
    }

    return businessIds;
  }

  async send(userId: string, dto: SendMessageDto): Promise<MessageResponseDto> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const savedMessage = await this.sendWithinBusinessScope(businessIds, dto);

    return this.toResponse(savedMessage);
  }

  async sendForBusiness(
    businessId: string,
    dto: SendMessageDto,
    manager?: EntityManager,
  ): Promise<MessageResponseDto> {
    const savedMessage = await this.sendWithinBusinessScope([businessId], dto, manager);
    return this.toResponse(savedMessage);
  }

  async findByConversation(userId: string, query: QueryMessagesDto): Promise<PaginatedMessagesResponseDto> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const conversation = await this.conversationsRepository.findOne({
      where: { id: query.conversationId, businessId: In(businessIds) },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId: conversation.id })
      .andWhere('message.businessId = :businessId', { businessId: conversation.businessId })
      .orderBy('message.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  private toResponse(message: Message): MessageResponseDto {
    return {
      id: message.id,
      businessId: message.businessId,
      conversationId: message.conversationId,
      senderType: message.senderType,
      direction: message.direction,
      content: message.content,
      messageType: message.messageType,
      externalMessageId: message.externalMessageId,
      sentAt: message.sentAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private async sendWithinBusinessScope(
    businessIds: string[],
    dto: SendMessageDto,
    manager?: EntityManager,
  ): Promise<Message> {
    if (!businessIds.length) {
      throw new ForbiddenException('No accessible businesses found');
    }

    const run = async (entityManager: EntityManager): Promise<Message> => {
      const conversationRepository = entityManager.getRepository(Conversation);
      const leadRepository = entityManager.getRepository(Lead);
      const messageRepository = entityManager.getRepository(Message);

      let conversation: Conversation | null = null;
      let lead: Lead | null = null;

      if (dto.conversationId) {
        conversation = await conversationRepository.findOne({
          where: { id: dto.conversationId, businessId: In(businessIds) },
          relations: { lead: { contact: true } },
        });

        if (!conversation) {
          throw new NotFoundException('Conversation not found');
        }

        lead = conversation.lead;
      } else {
        lead = await leadRepository.findOne({
          where: { id: dto.leadId!, businessId: In(businessIds) },
          relations: { contact: true },
        });

        if (!lead) {
          throw new NotFoundException('Lead not found');
        }

        conversation =
          (await conversationRepository
            .createQueryBuilder('conversation')
            .where('conversation.leadId = :leadId', { leadId: lead.id })
            .andWhere('conversation.businessId = :businessId', { businessId: lead.businessId })
            .orderBy('conversation.createdAt', 'DESC')
            .getOne()) ?? null;

        if (!conversation) {
          conversation = await conversationRepository.save(
            conversationRepository.create({
              businessId: lead.businessId,
              leadId: lead.id,
              channelType: lead.source === 'WHATSAPP' ? ChannelType.WHATSAPP : ChannelType.MANUAL,
              externalThreadId: null,
            }),
          );
        }
      }

      if (!lead) {
        lead = await leadRepository.findOne({
          where: { id: conversation.leadId, businessId: conversation.businessId },
          relations: { contact: true },
        });

        if (!lead) {
          throw new NotFoundException('Lead not found');
        }
      }

      const isWhatsAppContext =
        conversation.channelType === ChannelType.WHATSAPP || lead.source === 'WHATSAPP';

      let externalMessageId = dto.externalMessageId ?? null;

      if (isWhatsAppContext) {
        const activeWhatsAppIntegration = await this.integrationsService.findActiveIntegrationForBusiness(
          conversation.businessId,
          IntegrationProvider.WHATSAPP,
          entityManager,
        );

        if (!activeWhatsAppIntegration) {
          throw new BadRequestException('WhatsApp integration is not connected or enabled for this business');
        }

        const toPhone = lead.contact?.phone;
        if (!toPhone) {
          throw new BadRequestException('Lead contact does not have a phone number for WhatsApp delivery');
        }

        const sendResult = await this.integrationsService.sendWhatsAppTextMessage(
          activeWhatsAppIntegration,
          toPhone,
          dto.content,
        );

        externalMessageId = sendResult.externalMessageId ?? null;
        this.logger.debug(
          `WhatsApp message sent for business ${conversation.businessId}, lead ${lead.id}, response: ${JSON.stringify(
            sendResult.rawResponse,
          )}`,
        );
      }

      const message = messageRepository.create({
        businessId: conversation.businessId,
        conversationId: conversation.id,
        senderType: isWhatsAppContext ? SenderType.AGENT : dto.senderType ?? SenderType.AGENT,
        direction: isWhatsAppContext ? MessageDirection.OUTBOUND : dto.direction ?? MessageDirection.OUTBOUND,
        content: dto.content,
        messageType: isWhatsAppContext ? MessageType.TEXT : dto.messageType ?? MessageType.TEXT,
        externalMessageId,
        sentAt: new Date(),
      });

      return messageRepository.save(message);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }
}
