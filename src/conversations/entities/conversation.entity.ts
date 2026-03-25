import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Lead } from '../../leads/entities/lead.entity';
import { ChannelType } from '../../common/enums/channel-type.enum';
import { Message } from '../../messages/entities/message.entity';

@Entity({ name: 'conversations' })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid' })
  leadId: string;

  @Column({ type: 'enum', enum: ChannelType })
  channelType: ChannelType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalThreadId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @ManyToOne(() => Lead, (lead) => lead.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leadId' })
  lead: Lead;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
