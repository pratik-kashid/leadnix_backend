import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { Conversation } from './entities/conversation.entity';
import { Lead } from '../leads/entities/lead.entity';
import { TeamMembersModule } from '../team-members/team-members.module';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Lead]), TeamMembersModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
