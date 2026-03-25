import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this.usersRepository;
  }

  findByEmail(email: string, manager?: EntityManager): Promise<User | null> {
    return this.getRepository(manager).findOne({ where: { email } });
  }

  findById(id: string, manager?: EntityManager): Promise<User | null> {
    return this.getRepository(manager).findOne({ where: { id } });
  }

  findByResetTokenHash(tokenHash: string, manager?: EntityManager): Promise<User | null> {
    return this.getRepository(manager).findOne({ where: { passwordResetTokenHash: tokenHash } });
  }

  save(user: User, manager?: EntityManager): Promise<User> {
    return this.getRepository(manager).save(user);
  }

  create(
    input: Pick<User, 'name' | 'email' | 'passwordHash' | 'isActive'>,
    manager?: EntityManager,
  ): Promise<User> {
    const repository = this.getRepository(manager);
    const user = repository.create({
      ...input,
      isActive: input.isActive ?? true,
    });

    return repository.save(user);
  }
}
