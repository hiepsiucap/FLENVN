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
import { User } from '../users/user.entity';
import { FlashcardLabel } from './flashcard-label.entity';

export enum LabelType {
  TOPIC = 'topic',
  LEVEL = 'level',
  USAGE = 'usage',
  CUSTOM = 'custom',
}

@Entity('labels')
@Index(['userId', 'normalizedName'], { unique: true })
@Index(['userId', 'type'])
export class Label {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  normalizedName!: string;

  @Column({ type: 'enum', enum: LabelType, default: LabelType.CUSTOM })
  type!: LabelType;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @OneToMany(() => FlashcardLabel, (flashcardLabel) => flashcardLabel.label)
  flashcardLinks!: FlashcardLabel[];
}
