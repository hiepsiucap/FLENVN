import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ListeningGame, ListeningQuestion } from './listening-content';

@Entity('listening_sets')
@Index(['userId', 'cacheKey'], { unique: true })
export class ListeningSet {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') userId!: string;
  @Column({ length: 64 }) cacheKey!: string;
  @Column({ length: 24 }) game!: ListeningGame;
  @Column({ length: 10 }) difficulty!: 'easy' | 'medium' | 'hard';
  @Column({ length: 12, default: 'generating' }) status!:
    | 'generating'
    | 'ready'
    | 'failed';
  @Column('jsonb', { default: () => "'[]'::jsonb" })
  questions!: ListeningQuestion[];
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
