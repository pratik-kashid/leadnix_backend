import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { TeamMembersService } from '../team-members/team-members.service';
import { randomBytes } from 'crypto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { TeamMember } from '../team-members/entities/team-member.entity';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessesRepository: Repository<Business>,
    private readonly teamMembersService: TeamMembersService,
  ) {}

  private getRepository(manager?: EntityManager): Repository<Business> {
    return manager ? manager.getRepository(Business) : this.businessesRepository;
  }

  findById(id: string, manager?: EntityManager): Promise<Business | null> {
    return this.getRepository(manager).findOne({ where: { id } });
  }

  async findByPublicLeadToken(publicLeadToken: string, manager?: EntityManager): Promise<Business | null> {
    const business = await this.getRepository(manager).findOne({ where: { publicLeadToken } });
    return business;
  }

  create(
    input: Pick<Business, 'name' | 'phone' | 'email' | 'industry' | 'timezone'>,
    manager?: EntityManager,
  ): Promise<Business> {
    const repository = this.getRepository(manager);
    const business = repository.create({
      ...input,
      phone: input.phone ?? null,
      email: input.email ?? null,
      industry: input.industry ?? null,
      timezone: input.timezone ?? null,
    });

    return repository.save(business);
  }

  async getMyBusiness(userId: string, businessId?: string, manager?: EntityManager): Promise<Business> {
    let membership: TeamMember | null = null;

    if (businessId) {
      membership = await this.teamMembersService.findByUserIdAndBusinessId(userId, businessId, manager);
    }

    if (!membership) {
      membership = await this.teamMembersService.findFirstForUser(userId, manager);
    }

    if (!membership?.business) {
      throw new ForbiddenException('No accessible businesses found');
    }

    const business = membership.business;
    if (!business.publicLeadToken) {
      business.publicLeadToken = this.generatePublicLeadToken();
      return this.getRepository(manager).save(business);
    }

    return business;
  }

  async updateMyBusiness(
    userId: string,
    dto: UpdateBusinessDto,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Business> {
    const business = await this.getMyBusiness(userId, businessId, manager);
    const repository = this.getRepository(manager);

    if (dto.name !== undefined) business.name = dto.name;
    if (dto.phone !== undefined) business.phone = dto.phone;
    if (dto.email !== undefined) business.email = dto.email;
    if (dto.industry !== undefined) business.industry = dto.industry;
    if (dto.timezone !== undefined) business.timezone = dto.timezone;

    if (!business.publicLeadToken) {
      business.publicLeadToken = this.generatePublicLeadToken();
    }

    return repository.save(business);
  }

  private generatePublicLeadToken(): string {
    return randomBytes(24).toString('hex');
  }
}
