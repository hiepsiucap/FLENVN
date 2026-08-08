import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Book } from '../books/book.entity';
import { User } from '../users/user.entity';
import { PracticeGameResult } from './practice-game-result.entity';

@Entity('practice_sessions')
export class PracticeSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  bookId!: string | null;

  @Column({ default: 0 })
  totalFlashcards!: number;

  @Column({ default: 0 })
  totalGames!: number;

  @Column({ default: 0 })
  correctGames!: number;

  @Column({ default: 0 })
  incorrectGames!: number;

  @Column({ default: 0 })
  skippedGames!: number;

  @Column({ default: 0 })
  score!: number;

  @Column({ type: 'float', default: 0 })
  accuracy!: number;

  @Column({ type: 'integer', nullable: true })
  durationMs!: number | null;

  @Index()
  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @ManyToOne(() => Book, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bookId' })
  book!: Book | null;

  @OneToMany(() => PracticeGameResult, (result) => result.practiceSession)
  gameResults!: PracticeGameResult[];
}
