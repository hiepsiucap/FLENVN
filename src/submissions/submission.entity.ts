import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum SubmissionStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export enum SubmissionType {
  FEEDBACK = 'feedback',
  REPORT = 'report',
}

@Entity('submissions')
@Index(['createdAt'])
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 20 })
  type!: SubmissionType;

  @Column({ type: 'varchar', length: 150, nullable: true })
  subject!: string | null;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 20, default: SubmissionStatus.PENDING })
  status!: SubmissionStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  evidenceImageUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
