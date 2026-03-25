import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { Business } from './entities/business.entity';
import { TeamMembersModule } from '../team-members/team-members.module';

@Module({
  imports: [TypeOrmModule.forFeature([Business]), TeamMembersModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
