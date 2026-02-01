import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FlashCard } from '../flashcards/flashcard.entity';
import { User } from '../users/user.entity';

export enum SessionType {
  REVIEW = 'review',
  LEARN = 'learn',
  PRACTICE = 'practice',
}

export enum SessionResult {
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
  SKIPPED = 'skipped',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SessionType,
  })
  type: SessionType;

  @Column({
    type: 'enum',
    enum: SessionResult,
  })
  result: SessionResult;

  @Column({ nullable: true })
  responseTime: number; // in milliseconds

  @Column({ default: 0 })
  score: number;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  // Relationships
  @ManyToOne(() => User, user => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => FlashCard, flashcard => flashcard.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'flashcardId' })
  flashcard: FlashCard;

  @Column()
  flashcardId: string;
}
