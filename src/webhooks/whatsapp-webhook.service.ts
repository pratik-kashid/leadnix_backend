import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { Business } from '../businesses/entities/business.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Integration } from '../integrations/entities/integration.entity';
import { Lead } from '../leads/entities/lead.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { MessagesService } from '../messages/messages.service';
import { AiQueue } from '../queues/ai.queue';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { ChannelType } from '../common/enums/channel-type.enum';
import { LeadPriority } from '../common/enums/lead-priority.enum';
import { LeadStatus } from '../common/enums/lead-status.enum';
import { MessageDirection } from '../common/enums/message-direction.enum';
import { MessageType } from '../common/enums/message-type.enum';
import { SenderType } from '../common/enums/sender-type.enum';
import { SendMessageDto } from '../messages/dto/send-message.dto';

type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: WhatsAppWebhookValue;
    }>;
  }>;
};

type WhatsAppWebhookValue = {
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{
    wa_id?: string;
    profile?: {
      name?: string;
    };
  }>;
  messages?: Array<{
    id?: string;
    from?: string;
    timestamp?: string;
    type?: string;
    text?: {
      body?: string;
    };
  }>;
  statuses?: Array<unknown>;
};

type InboundTextMessageEvent = {
  wabaId?: string | null;
  phoneNumberId?: string | null;
  senderPhone: string;
  senderName?: string | null;
  text: string;
  externalMessageId?: string | null;
  timestamp?: string | null;
};

type ProcessedInboundMessage = {
  businessId: string;
  leadId: string;
  conversationId: string;
  processed: boolean;
  autoReplyEnabled: boolean;
};

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly aiQueue: AiQueue,
    private readonly aiService: AiService,
    private readonly messagesService: MessagesService,
    @InjectRepository(Integration)
    private readonly integrationsRepository: Repository<Integration>,
    @InjectRepository(Contact)
    private readonly contactsRepository: Repository<Contact>,
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
  ) {}

  async verifyWebhook(mode: string, verifyToken: string, challenge: string): Promise<string> {
    const expectedToken = this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (!expectedToken) {
      throw new ForbiddenException('WhatsApp webhook verification is not configured');
    }

    if (mode !== 'subscribe' || verifyToken !== expectedToken || !challenge) {
      throw new UnauthorizedException('Webhook verification failed');
    }

    return challenge;
  }

  async handleWebhook(payload: unknown): Promise<{ success: true }> {
    this.logSafePayload(payload);

    const events = this.extractInboundTextEvents(payload);
    for (const event of events) {
      const result = await this.processInboundTextEvent(event);
      if (result.processed) {
        void this.enqueueLeadAiJobs(result.businessId, result.leadId).catch((error) => {
          this.logger.warn(
            `Could not enqueue AI jobs for WhatsApp lead ${result.leadId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });

        if (result.autoReplyEnabled) {
          void this.maybeSendAutoReply(result.businessId, result.leadId, result.conversationId).catch((error) => {
            this.logger.warn(
              `Could not send WhatsApp auto-reply for lead ${result.leadId}: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
        }
      }
    }

    return { success: true };
  }

  private async processInboundTextEvent(event: InboundTextMessageEvent): Promise<ProcessedInboundMessage> {
    return this.dataSource.transaction(async (manager) => {
      const integration = await this.findMatchingIntegration(manager, event);

      if (!integration) {
        this.logger.warn(
          `Skipping unmatched WhatsApp inbound event for phoneNumberId=${event.phoneNumberId ?? 'unknown'} wabaId=${event.wabaId ?? 'unknown'}`,
        );
        return { businessId: '', leadId: '', conversationId: '', processed: false, autoReplyEnabled: false };
      }

      const messageRepository = manager.getRepository(Message);
      if (event.externalMessageId) {
        const existingMessage = await messageRepository.findOne({
          where: {
            businessId: integration.businessId,
            externalMessageId: event.externalMessageId,
          },
        });

        if (existingMessage) {
          this.logger.debug(`Ignoring duplicate WhatsApp message ${event.externalMessageId}`);
          return {
            businessId: integration.businessId,
            leadId: '',
            conversationId: '',
            processed: false,
            autoReplyEnabled: false,
          };
        }
      }

      const contact = await this.findOrCreateContact(manager, integration.businessId, event);
      const lead = await this.findOrCreateLead(manager, integration.businessId, contact.id, event.text);
      const conversation = await this.findOrCreateConversation(manager, integration.businessId, lead.id);
      const sentAt = this.parseMessageTimestamp(event.timestamp) ?? new Date();

      const message = messageRepository.create({
        businessId: integration.businessId,
        conversationId: conversation.id,
        senderType: SenderType.CUSTOMER,
        direction: MessageDirection.INBOUND,
        content: event.text,
        messageType: MessageType.TEXT,
        externalMessageId: event.externalMessageId ?? null,
        sentAt,
      });

      await messageRepository.save(message);

      lead.lastMessageAt = sentAt;
      await manager.getRepository(Lead).save(lead);

      return {
        businessId: integration.businessId,
        leadId: lead.id,
        conversationId: conversation.id,
        processed: true,
        autoReplyEnabled: integration.autoReplyEnabled,
      };
    });
  }

  private async findMatchingIntegration(
    manager: EntityManager,
    event: InboundTextMessageEvent,
  ): Promise<Integration | null> {
    const integrations = await manager.getRepository(Integration).find({
      where: { provider: IntegrationProvider.WHATSAPP, isConnected: true, isEnabled: true },
      order: { createdAt: 'ASC' },
    });

    const normalizedPhoneNumberId = event.phoneNumberId?.trim();

    const matchingIntegration = integrations.find((integration) => {
      const configJson = integration.configJson ?? {};
      const configPhoneNumberId = this.getStringValue(configJson.phoneNumberId);
      const configMetadataPhoneNumberId = this.getStringValue(this.asRecord(configJson.metadata)?.phoneNumberId);

      return (
        Boolean(normalizedPhoneNumberId) &&
        ((integration.phoneNumberId && integration.phoneNumberId === normalizedPhoneNumberId) ||
          (configPhoneNumberId && configPhoneNumberId === normalizedPhoneNumberId) ||
          (configMetadataPhoneNumberId && configMetadataPhoneNumberId === normalizedPhoneNumberId))
      );
    });

    if (!matchingIntegration) {
      this.logger.warn(
        `No matching WhatsApp integration found for phoneNumberId=${normalizedPhoneNumberId ?? 'unknown'} wabaId=${event.wabaId ?? 'unknown'}`,
      );
      return null;
    }

    return matchingIntegration;
  }

  private async maybeSendAutoReply(businessId: string, leadId: string, conversationId: string): Promise<void> {
    const activeIntegration = await this.integrationsRepository.findOne({
      where: {
        businessId,
        provider: IntegrationProvider.WHATSAPP,
        isConnected: true,
        isEnabled: true,
        autoReplyEnabled: true,
      },
    });

    if (!activeIntegration) {
      this.logger.debug(`Skipping WhatsApp auto-reply for lead ${leadId} because auto-reply is disabled or integration is inactive`);
      return;
    }

    const suggestion = await this.aiService.suggestReplyForBusiness(businessId, leadId, {});
    const replyText = suggestion.suggestedReply?.trim();

    if (!replyText) {
      this.logger.warn(`AI returned an empty WhatsApp auto-reply for lead ${leadId}`);
      return;
    }

    const outbound = await this.messagesService.sendForBusiness(businessId, {
      conversationId,
      content: replyText,
    } as SendMessageDto);

    this.logger.debug(
      `WhatsApp auto-reply sent for business ${businessId}, lead ${leadId}, aiRun=${suggestion.aiRunId}, message=${outbound.id}`,
    );
  }

  private async findOrCreateContact(
    manager: EntityManager,
    businessId: string,
    event: InboundTextMessageEvent,
  ): Promise<Contact> {
    const repository = manager.getRepository(Contact);
    const existing = await repository.findOne({
      where: {
        businessId,
        phone: event.senderPhone,
      },
    });

    const fallbackName = this.buildContactName(event.senderName, event.senderPhone);

    if (existing) {
      let shouldSave = false;

      if (!existing.phone) {
        existing.phone = event.senderPhone;
        shouldSave = true;
      }

      if (event.senderName && this.shouldUpdateContactName(existing.name, event.senderName, event.senderPhone)) {
        existing.name = event.senderName;
        shouldSave = true;
      } else if (this.isGenericContactName(existing.name) && fallbackName !== existing.name) {
        existing.name = fallbackName;
        shouldSave = true;
      }

      if (!existing.source) {
        existing.source = 'WHATSAPP';
        shouldSave = true;
      }

      if (shouldSave) {
        return repository.save(existing);
      }

      return existing;
    }

    const contact = repository.create({
      businessId,
      name: fallbackName,
      phone: event.senderPhone,
      email: null,
      socialHandle: null,
      source: 'WHATSAPP',
    });

    return repository.save(contact);
  }

  private async findOrCreateLead(
    manager: EntityManager,
    businessId: string,
    contactId: string,
    messageText: string,
  ): Promise<Lead> {
    const repository = manager.getRepository(Lead);
    const existing = await repository.findOne({
      where: { businessId, contactId },
      order: { createdAt: 'DESC' },
    });

    if (existing) {
      if (!existing.lastMessageAt) {
        existing.lastMessageAt = new Date();
        await repository.save(existing);
      }

      return existing;
    }

    const title = this.buildLeadTitle(messageText);
    const lead = repository.create({
      businessId,
      contactId,
      title,
      source: 'WHATSAPP',
      status: LeadStatus.NEW,
      priority: LeadPriority.MEDIUM,
      notes: messageText,
      assignedToUserId: null,
      lastMessageAt: new Date(),
    });

    return repository.save(lead);
  }

  private async findOrCreateConversation(
    manager: EntityManager,
    businessId: string,
    leadId: string,
  ): Promise<Conversation> {
    const repository = manager.getRepository(Conversation);
    const existing = await repository.findOne({
      where: { businessId, leadId, channelType: ChannelType.WHATSAPP },
      order: { createdAt: 'DESC' },
    });

    if (existing) {
      return existing;
    }

    const conversation = repository.create({
      businessId,
      leadId,
      channelType: ChannelType.WHATSAPP,
      externalThreadId: null,
    });

    return repository.save(conversation);
  }

  private extractInboundTextEvents(payload: unknown): InboundTextMessageEvent[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const record = payload as WhatsAppWebhookPayload;
    const events: InboundTextMessageEvent[] = [];

    for (const entry of record.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages?.length) {
          continue;
        }

        const phoneNumberId = value.metadata?.phone_number_id ?? null;
        const wabaId = entry.id ?? null;
        const senderName = value.contacts?.[0]?.profile?.name ?? null;

        for (const message of value.messages) {
          if (message.type !== 'text' || !message.text?.body?.trim()) {
            continue;
          }

          events.push({
            wabaId,
            phoneNumberId,
            senderPhone: message.from ?? value.contacts?.[0]?.wa_id ?? '',
            senderName,
            text: message.text.body.trim(),
            externalMessageId: message.id ?? null,
            timestamp: message.timestamp ?? null,
          });
        }
      }
    }

    return events.filter((event) => Boolean(event.senderPhone));
  }

  private async enqueueLeadAiJobs(businessId: string, leadId: string): Promise<void> {
    await Promise.all([
      this.aiQueue.enqueueSummarizeLead({ businessId, leadId }),
      this.aiQueue.enqueueScorePriority({ businessId, leadId }),
    ]);
  }

  private buildContactName(profileName: string | null | undefined, senderPhone: string): string {
    const name = profileName?.trim();
    if (name) {
      return name;
    }

    return `WhatsApp ${senderPhone.slice(-4) || 'Contact'}`;
  }

  private buildLeadTitle(messageText: string): string {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage) {
      return 'WhatsApp Inquiry';
    }

    const snippet = trimmedMessage.length > 60 ? `${trimmedMessage.slice(0, 57)}...` : trimmedMessage;
    return `WhatsApp Inquiry: ${snippet}`;
  }

  private shouldUpdateContactName(currentName: string, incomingName: string, senderPhone: string): boolean {
    if (!incomingName?.trim()) {
      return false;
    }

    if (currentName === incomingName) {
      return false;
    }

    return this.isGenericContactName(currentName) || currentName === senderPhone;
  }

  private isGenericContactName(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    return (
      normalized === 'whatsapp contact' ||
      normalized === 'contact' ||
      normalized.startsWith('whatsapp inquiry') ||
      normalized.startsWith('whatsapp ')
    );
  }

  private parseMessageTimestamp(timestamp?: string | null): Date | null {
    if (!timestamp) {
      return null;
    }

    const seconds = Number(timestamp);
    if (Number.isNaN(seconds)) {
      return null;
    }

    return new Date(seconds * 1000);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }

  private getStringValue(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private logSafePayload(payload: unknown): void {
    const environment = this.configService.get<string>('NODE_ENV') ?? 'development';
    const isDevelopment = environment !== 'production';

    if (!isDevelopment) {
      this.logger.log('Received WhatsApp webhook event');
      return;
    }

    const summary = this.extractSummary(payload);
    this.logger.debug(`Received WhatsApp webhook event: ${JSON.stringify(summary)}`);
  }

  private extractSummary(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      return { received: true };
    }

    const record = payload as WhatsAppWebhookPayload;
    let textMessageCount = 0;

    for (const entry of record.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        textMessageCount += messages.filter((message) => message.type === 'text').length;
      }
    }

    return {
      object: record.object ?? null,
      entryCount: Array.isArray(record.entry) ? record.entry.length : 0,
      textMessageCount,
    };
  }
}
