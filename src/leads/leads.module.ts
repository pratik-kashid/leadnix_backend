import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { Lead } from './entities/lead.entity';
import { ContactsModule } from '../contacts/contacts.module';
import { TeamMembersModule } from '../team-members/team-members.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [TypeOrmModule.forFeature([Lead]), ContactsModule, TeamMembersModule, QueuesModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
