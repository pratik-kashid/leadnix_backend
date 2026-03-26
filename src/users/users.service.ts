import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  update(user: User, manager?: EntityManager): Promise<User> {
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

  async updateMe(user: User | null, input: Partial<Pick<User, 'name' | 'email'>>): Promise<User> {
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (input.email && input.email !== user.email) {
      const existingUser = await this.findByEmail(input.email);
      if (existingUser && existingUser.id !== user.id) {
        throw new ConflictException('Email is already registered');
      }
      user.email = input.email;
    }

    if (typeof input.name === 'string' && input.name.trim().length > 0) {
      user.name = input.name.trim();
    }

    return this.save(user);
  }

  async updateProfilePhoto(user: User | null, profilePhotoUrl: string | null): Promise<User> {
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.profilePhotoUrl = profilePhotoUrl;
    return this.save(user);
  }
}
