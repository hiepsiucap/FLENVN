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

@Entity('flashcards')
@Index(['user', 'word'], { unique: true })
export class FlashCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  word: string;

  @Column({ nullable: true })
  pronunciation: string;

  @Column('text', { nullable: true })
  definition: string;

  @Column('text', { nullable: true })
  translation: string;

  @Column({ nullable: true })
  audioUrl: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column('text', { nullable: true })
  example: string;

  @Column('text', { nullable: true })
  exampleTranslation: string;

  // Spaced repetition fields
  @Column({ default: 0 })
  easeFactor: number;

  @Column({ default: 0 })
  interval: number;

  @Column({ default: 0 })
  repetitions: number;

  @Column({ nullable: true })
  nextReviewDate: Date;

  @Column({ default: 'new' })
  status: string; // 'new', 'learning', 'reviewing', 'mastered'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => User, user => user.flashcards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Book, book => book.flashcards, { nullable: true })
  @JoinColumn({ name: 'bookId' })
  book: Book;

  @Column({ nullable: true })
  bookId: string;

  @OneToMany(() => Session, session => session.flashcard)
  sessions: Session[];
}
