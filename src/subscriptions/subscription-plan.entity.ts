import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserSubscription } from './user-subscription.entity';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // Free, Basic, Premium, Pro

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number; // Monthly price

  @Column({ default: 5 })
  maxBooks: number;

  @Column({ default: 50000 })
  maxWords: number; // Total words across all books

  @Column({ default: 100 })
  maxFlashcards: number;

  @Column({ type: 'jsonb', default: {} })
  features: Record<string, boolean>; // e.g., { emailSupport: true, apiAccess: false }

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => UserSubscription, subscription => subscription.plan)
  userSubscriptions: UserSubscription[];
}
