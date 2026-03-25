import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Contact } from '../../contacts/entities/contact.entity';
import { LeadPriority } from '../../common/enums/lead-priority.enum';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { Task } from '../../tasks/entities/task.entity';
import { OneToMany } from 'typeorm';

@Entity({ name: 'leads' })
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid' })
  contactId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  source: string;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  @Column({ type: 'enum', enum: LeadPriority, default: LeadPriority.MEDIUM })
  priority: LeadPriority;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedToUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @ManyToOne(() => Contact, (contact) => contact.leads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contactId' })
  contact: Contact;

  @OneToMany(() => Conversation, (conversation) => conversation.lead)
  conversations: Conversation[];

  @OneToMany(() => Task, (task) => task.lead)
  tasks: Task[];
}
