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

  @Column({ type: 'boolean', default: false })
  isEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  autoReplyEnabled: boolean;

  @Column({ type: 'enum', enum: IntegrationStatus, default: IntegrationStatus.DISCONNECTED })
  status: IntegrationStatus;

  @Column({ type: 'jsonb' })
  configJson: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Business, (business) => business.integrations, { onDelete: 'CASCADE' })
  business: Business;
}
