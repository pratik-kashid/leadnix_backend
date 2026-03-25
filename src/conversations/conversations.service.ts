import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TeamMembersService } from '../team-members/team-members.service';
import { Lead } from '../leads/entities/lead.entity';
import { Conversation } from './entities/conversation.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { Message } from '../messages/entities/message.entity';
import { MessageResponseDto } from '../messages/dto/message-response.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    private readonly teamMembersService: TeamMembersService,
  ) {}

  private async getAccessibleBusinessIds(userId: string): Promise<string[]> {
    const memberships = await this.teamMembersService.findByUserId(userId);
    const businessIds = [...new Set(memberships.map((membership) => membership.businessId))];

    if (!businessIds.length) {
      throw new ForbiddenException('No accessible businesses found');
    }

    return businessIds;
  }

  private async getAccessibleLeadOrThrow(userId: string, leadId: string): Promise<Lead> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const lead = await this.leadsRepository.findOne({
      where: { id: leadId, businessId: In(businessIds) },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async create(userId: string, dto: CreateConversationDto): Promise<ConversationResponseDto> {
    const lead = await this.getAccessibleLeadOrThrow(userId, dto.leadId);
    const conversation = this.conversationsRepository.create({
      businessId: lead.businessId,
      leadId: lead.id,
      channelType: dto.channelType,
      externalThreadId: dto.externalThreadId ?? null,
    });

    const saved = await this.conversationsRepository.save(conversation);
    return this.toResponse(saved);
  }

  async findByLead(userId: string, leadId: string): Promise<ConversationResponseDto[]> {
    const lead = await this.getAccessibleLeadOrThrow(userId, leadId);
    const conversations = await this.conversationsRepository.find({
      where: { leadId: lead.id, businessId: lead.businessId },
      order: { createdAt: 'DESC' },
    });

    return conversations.map((conversation) => this.toResponse(conversation));
  }

  async findOne(userId: string, conversationId: string): Promise<ConversationResponseDto> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const conversation = await this.conversationsRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.messages', 'message')
      .where('conversation.id = :conversationId', { conversationId })
      .andWhere('conversation.businessId IN (:...businessIds)', { businessIds })
      .orderBy('message.createdAt', 'ASC')
      .getOne();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.toResponse(conversation);
  }

  private toResponse(conversation: Conversation): ConversationResponseDto {
    return {
      id: conversation.id,
      businessId: conversation.businessId,
      leadId: conversation.leadId,
      channelType: conversation.channelType,
      externalThreadId: conversation.externalThreadId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages?.map((message) => this.mapMessage(message)),
    };
  }

  private mapMessage(message: Message): MessageResponseDto {
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
