import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMembersController } from './team-members.controller';
import { TeamMembersService } from './team-members.service';
import { TeamMember } from './entities/team-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TeamMember])],
  controllers: [TeamMembersController],
  providers: [TeamMembersService],
  exports: [TeamMembersService],
})
export class TeamMembersModule {}
