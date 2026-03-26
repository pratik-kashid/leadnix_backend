import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { IntegrationProvider } from '../../common/enums/integration-provider.enum';
import { IntegrationStatus } from '../../common/enums/integration-status.enum';

@Entity({ name: 'integrations' })
@Index(['businessId', 'provider'], { unique: true })
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'enum', enum: IntegrationProvider })
  provider: IntegrationProvider;

  @Column({ type: 'boolean', default: false })
  isConnected: boolean;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  autoReplyEnabled: boolean;

  @Column({ type: 'enum', enum: IntegrationStatus, nullable: true })
  status: IntegrationStatus | null;

  @Column({ type: 'varchar', nullable: true })
  externalAccountId: string | null;

  @Column({ type: 'varchar', nullable: true })
  wabaId: string | null;

  @Column({ type: 'varchar', nullable: true })
  phoneNumberId: string | null;

  @Column({ type: 'text', nullable: true })
  accessTokenEncrypted: string | null;

  @Column({ type: 'boolean', default: false })
  webhookSubscribed: boolean;

  @Column({ type: 'jsonb', nullable: true })
  configJson: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Business, (business) => business.integrations, { onDelete: 'CASCADE' })
  business: Business;
}
