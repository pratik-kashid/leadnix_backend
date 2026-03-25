import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRun } from './entities/ai-run.entity';
import { Lead } from '../leads/entities/lead.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { TeamMembersModule } from '../team-members/team-members.module';

@Module({
  imports: [TypeOrmModule.forFeature([AiRun, Lead, Conversation, Message]), TeamMembersModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
