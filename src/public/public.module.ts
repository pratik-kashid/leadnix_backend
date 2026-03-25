import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsModule } from '../contacts/contacts.module';
import { Lead } from '../leads/entities/lead.entity';
import { Business } from '../businesses/entities/business.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [TypeOrmModule.forFeature([Business, Lead, Conversation, Message]), ContactsModule, QueuesModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
