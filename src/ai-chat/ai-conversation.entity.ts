import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { EnglishLevel } from './dto/create-conversation.dto';
import { AiMessage } from './ai-message.entity';

@Entity('ai_conversations')
@Index(['userId', 'updatedAt'])
export class AiConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120, default: 'New conversation' })
  title!: string;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  targetLanguage!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  englishLevel!: EnglishLevel | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @OneToMany(() => AiMessage, (message) => message.conversation)
  messages!: AiMessage[];
}
