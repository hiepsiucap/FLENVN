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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => FlashCard, flashcard => flashcard.user)
  flashcards: FlashCard[];

  @OneToMany(() => Session, session => session.user)
  sessions: Session[];
}
