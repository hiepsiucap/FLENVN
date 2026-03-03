import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FlashCard } from '../flashcards/flashcard.entity';
import { Session } from '../sessions/session.entity';
import { UserSubscription } from '../subscriptions/user-subscription.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  username: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string;

  @Column({ nullable: true })
  passwordResetToken: string;

  @Column({ nullable: true })
  passwordResetExpires: Date;

  @Column({ default: 1 })
  level: number;

  @Column({ default: 0 })
  exp: number;

  @Column({ default: 0 })
  streak: number;

  @Column({ nullable: true })
  lastActive: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  booksCount: number; // Track current book count

  @Column({ default: 0 })
  totalWordsUsed: number; // Track total words used across books

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => FlashCard, flashcard => flashcard.user)
  flashcards: FlashCard[];

  @OneToMany(() => Session, session => session.user)
  sessions: Session[];

  @OneToMany(() => UserSubscription, subscription => subscription.user)
  subscriptions: UserSubscription[];
}
