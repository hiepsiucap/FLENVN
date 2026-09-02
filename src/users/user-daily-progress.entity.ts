import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_daily_progress')
@Index(['userId', 'localDate'], { unique: true })
export class UserDailyProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'date' })
  localDate!: string;

  @Column({ type: 'integer', default: 0 })
  earnedScore!: number;

  @Column({ type: 'integer' })
  targetScore!: number;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
