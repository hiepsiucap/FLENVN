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
  static readonly DEFAULT_AVATAR_URL =
    'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/profile.jpg';

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ type: 'varchar', nullable: true })
  username!: string | null;

  @Column({
    default: User.DEFAULT_AVATAR_URL,
  })
  avatar!: string;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ type: 'varchar', nullable: true })
  emailVerificationToken!: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordResetToken!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpires!: Date | null;

  @Column({ default: 1 })
  level!: number;

  @Column({ default: 0 })
  exp!: number;

  @Column({ default: 0 })
  streak!: number;

  @Column({ default: 0 })
  longestStreak!: number;

  @Column({ type: 'integer', default: 100 })
  dailyScoreTarget!: number;

  @Column({ type: 'integer', nullable: true })
  pendingDailyScoreTarget!: number | null;

  @Column({ type: 'date', nullable: true })
  targetEffectiveDate!: string | null;

  @Column({ type: 'varchar', default: 'Asia/Bangkok' })
  timezone!: string;

  @Column({ type: 'date', nullable: true })
  lastStreakDate!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastActive!: Date | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isAdmin!: boolean;

  @Column({ default: 0 })
  booksCount!: number; // Track current book count

  @Column({ default: 0 })
  totalWordsUsed!: number; // Track total words used across books

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relationships
  @OneToMany(() => FlashCard, (flashcard) => flashcard.user)
  flashcards!: FlashCard[];

  @OneToMany(() => Session, (session) => session.user)
  sessions!: Session[];

  @OneToMany(() => UserSubscription, (subscription) => subscription.user)
  subscriptions!: UserSubscription[];
}
