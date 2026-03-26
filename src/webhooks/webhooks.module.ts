import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { MessagesModule } from '../messages/messages.module';
import { QueuesModule } from '../queues/queues.module';
import { Contact } from '../contacts/entities/contact.entity';
import { Lead } from '../leads/entities/lead.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { Integration } from '../integrations/entities/integration.entity';
import { WebhooksController } from './webhooks.controller';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, Contact, Lead, Conversation, Message]),
    AiModule,
    MessagesModule,
    QueuesModule,
  ],
  controllers: [WebhooksController],
  providers: [WhatsappWebhookService],
})
export class WebhooksModule {}
