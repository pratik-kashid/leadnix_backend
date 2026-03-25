import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
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

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    private readonly teamMembersService: TeamMembersService,
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
    const savedMessage = await this.dataSource.transaction(async (manager) => {
      const businessIds = await this.getAccessibleBusinessIds(userId);
      const conversationRepository = manager.getRepository(Conversation);
      const leadRepository = manager.getRepository(Lead);
      const messageRepository = manager.getRepository(Message);

      let conversation: Conversation | null = null;

      if (dto.conversationId) {
        conversation = await conversationRepository.findOne({
          where: { id: dto.conversationId, businessId: In(businessIds) },
        });

        if (!conversation) {
          throw new NotFoundException('Conversation not found');
        }
      } else {
        const lead = await leadRepository.findOne({
          where: { id: dto.leadId!, businessId: In(businessIds) },
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
              channelType: ChannelType.MANUAL,
              externalThreadId: null,
            }),
          );
        }
      }

      const message = messageRepository.create({
        businessId: conversation.businessId,
        conversationId: conversation.id,
        senderType: dto.senderType ?? SenderType.AGENT,
        direction: dto.direction ?? MessageDirection.OUTBOUND,
        content: dto.content,
        messageType: dto.messageType ?? MessageType.TEXT,
        externalMessageId: dto.externalMessageId ?? null,
        sentAt: new Date(),
      });

      return messageRepository.save(message);
    });

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
}
