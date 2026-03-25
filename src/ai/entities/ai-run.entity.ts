import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Lead } from '../../leads/entities/lead.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { AiRunStatus } from '../../common/enums/ai-run-status.enum';
import { AiRunType } from '../../common/enums/ai-run-type.enum';

@Entity({ name: 'ai_runs' })
export class AiRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid', nullable: true })
  leadId: string | null;

  @Column({ type: 'uuid', nullable: true })
  conversationId: string | null;

  @Column({ type: 'enum', enum: AiRunType })
  type: AiRunType;

  @Column({ type: 'varchar', length: 255 })
  model: string;

  @Column({ type: 'jsonb' })
  inputJson: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  outputJson: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: AiRunStatus, default: AiRunStatus.PENDING })
  status: AiRunStatus;

  @Column({ type: 'integer', nullable: true })
  latencyMs: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @ManyToOne(() => Lead, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'leadId' })
  lead: Lead | null;

  @ManyToOne(() => Conversation, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation | null;
}
