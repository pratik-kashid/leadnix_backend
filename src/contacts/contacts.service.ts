import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';

export type ContactInput = Pick<Contact, 'name' | 'phone' | 'email' | 'socialHandle' | 'source' | 'businessId'>;

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactsRepository: Repository<Contact>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<Contact> {
    return manager ? manager.getRepository(Contact) : this.contactsRepository;
  }

  findReusableByEmailOrPhone(
    businessId: string,
    email?: string | null,
    phone?: string | null,
    manager?: EntityManager,
  ): Promise<Contact | null> {
    const conditions: FindOptionsWhere<Contact>[] = [];

    if (email) {
      conditions.push({ businessId, email });
    }

    if (phone) {
      conditions.push({ businessId, phone });
    }

    if (!conditions.length) {
      return Promise.resolve(null);
    }

    return this.getRepository(manager).findOne({
      where: conditions,
    });
  }

  create(input: ContactInput, manager?: EntityManager): Promise<Contact> {
    const repository = this.getRepository(manager);
    const contact = repository.create({
      ...input,
      phone: input.phone ?? null,
      email: input.email ?? null,
      socialHandle: input.socialHandle ?? null,
      source: input.source ?? null,
    });

    return repository.save(contact);
  }
}
