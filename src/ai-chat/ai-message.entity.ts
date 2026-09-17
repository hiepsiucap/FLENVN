import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiConversation } from './ai-conversation.entity';

export enum AiMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('ai_messages')
@Index(['conversationId', 'createdAt'])
@Index(['conversationId', 'clientMessageId'], {
  unique: true,
  where: '"clientMessageId" IS NOT NULL',
})
export class AiMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'enum', enum: AiMessageRole })
  role!: AiMessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'uuid', nullable: true })
  clientMessageId!: string | null;

  @Index({ unique: true, where: '"replyToMessageId" IS NOT NULL' })
  @Column({ type: 'uuid', nullable: true })
  replyToMessageId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null;

  @Column({ type: 'integer', nullable: true })
  inputTokens!: number | null;

  @Column({ type: 'integer', nullable: true })
  outputTokens!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => AiConversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation!: AiConversation;
}
