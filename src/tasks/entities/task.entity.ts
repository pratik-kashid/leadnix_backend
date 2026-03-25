import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Lead } from '../../leads/entities/lead.entity';
import { TaskStatus } from '../../common/enums/task-status.enum';

@Entity({ name: 'tasks' })
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid' })
  leadId: string;

  @Column({ type: 'uuid', nullable: true })
  assignedToUserId: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.OPEN })
  status: TaskStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @ManyToOne(() => Lead, (lead) => lead.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leadId' })
  lead: Lead;
}
