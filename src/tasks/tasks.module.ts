import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import { Lead } from '../leads/entities/lead.entity';
import { TeamMembersModule } from '../team-members/team-members.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Lead]), TeamMembersModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
