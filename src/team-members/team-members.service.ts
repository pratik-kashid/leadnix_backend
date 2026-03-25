import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TeamMember } from './entities/team-member.entity';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class TeamMembersService {
  constructor(
    @InjectRepository(TeamMember)
    private readonly teamMembersRepository: Repository<TeamMember>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<TeamMember> {
    return manager ? manager.getRepository(TeamMember) : this.teamMembersRepository;
  }

  create(
    input: Pick<TeamMember, 'userId' | 'businessId' | 'role'>,
    manager?: EntityManager,
  ): Promise<TeamMember> {
    const repository = this.getRepository(manager);
    const teamMember = repository.create(input);
    return repository.save(teamMember);
  }

  findByUserIdAndBusinessId(userId: string, businessId: string, manager?: EntityManager): Promise<TeamMember | null> {
    return this.getRepository(manager).findOne({
      where: { userId, businessId },
      relations: { user: true, business: true },
    });
  }

  findFirstForUser(userId: string, manager?: EntityManager): Promise<TeamMember | null> {
    return this.getRepository(manager).findOne({
      where: { userId },
      relations: { user: true, business: true },
      order: { createdAt: 'ASC' },
    });
  }

  findByUserId(userId: string, manager?: EntityManager): Promise<TeamMember[]> {
    return this.getRepository(manager).find({
      where: { userId },
      relations: { user: true, business: true },
      order: { createdAt: 'ASC' },
    });
  }
}
