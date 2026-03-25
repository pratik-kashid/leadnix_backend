import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { SenderType } from '../../common/enums/sender-type.enum';
import { MessageDirection } from '../../common/enums/message-direction.enum';
import { MessageType } from '../../common/enums/message-type.enum';

@Entity({ name: 'messages' })
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'enum', enum: SenderType })
  senderType: SenderType;

  @Column({ type: 'enum', enum: MessageDirection })
  direction: MessageDirection;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: MessageType })
  messageType: MessageType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalMessageId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;
}
