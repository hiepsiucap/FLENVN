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
import { SessionResult } from './session.entity';
import { PracticeSession } from './practice-session.entity';

@Entity('practice_game_results')
export class PracticeGameResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  gameType!: string;

  @Column({
    type: 'enum',
    enum: SessionResult,
  })
  result!: SessionResult;

  @Column({ type: 'integer', nullable: true })
  responseTime!: number | null;

  @Column({ default: 0 })
  score!: number;

  @Index()
  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => PracticeSession, (session) => session.gameResults, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'practiceSessionId' })
  practiceSession!: PracticeSession;

  @Column()
  practiceSessionId!: string;

  @ManyToOne(() => FlashCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flashcardId' })
  flashcard!: FlashCard;

  @Column()
  flashcardId!: string;
}
