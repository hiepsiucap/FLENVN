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
import { Book } from '../books/book.entity';
import { Session } from '../sessions/session.entity';
import { User } from '../users/user.entity';
import { PartOfSpeech } from './part-of-speech.enum';

export enum FlashCardStatus {
  NEW = 'new',
  LEARNING = 'learning',
  REVIEWING = 'reviewing',
  MASTERED = 'mastered',
}

@Entity('flashcards')
@Index(['userId', 'word'], { unique: true })
export class FlashCard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  word!: string;

  @Column({
    type: 'enum',
    enum: PartOfSpeech,
    nullable: true,
  })
  partOfSpeech!: PartOfSpeech | null;

  @Column({ type: 'varchar', nullable: true })
  pronunciation!: string | null;

  @Column('text', { nullable: true })
  definition!: string | null;

  @Column('text', { nullable: true })
  translation!: string | null;

  @Column({ type: 'varchar', nullable: true })
  audioUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @Column('text', { nullable: true })
  example!: string | null;

  @Column('text', { nullable: true })
  exampleTranslation!: string | null;

  // Spaced repetition fields
  @Column({ type: 'float', default: 2.5 })
  easeFactor!: number;

  @Column({ default: 0 })
  interval!: number;

  @Column({ default: 0 })
  repetitions!: number;

  @Column({ type: 'timestamp', nullable: true })
  nextReviewDate!: Date | null;

  @Column({
    type: 'enum',
    enum: FlashCardStatus,
    default: FlashCardStatus.NEW,
  })
  status!: FlashCardStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relationships
  @ManyToOne(() => User, (user) => user.flashcards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @ManyToOne(() => Book, (book) => book.flashcards, { nullable: true })
  @JoinColumn({ name: 'bookId' })
  book!: Book | null;

  @Column({ type: 'uuid', nullable: true })
  bookId!: string | null;

  @OneToMany(() => Session, (session) => session.flashcard)
  sessions!: Session[];
}
