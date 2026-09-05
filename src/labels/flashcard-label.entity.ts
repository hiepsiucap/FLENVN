import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { FlashCard } from '../flashcards/flashcard.entity';
import { Label } from './label.entity';

export enum LabelSource {
  MANUAL = 'manual',
  GEMINI = 'gemini',
  SYSTEM = 'system',
}

@Entity('flashcard_labels')
@Index(['labelId'])
export class FlashcardLabel {
  @PrimaryColumn({ type: 'uuid' })
  flashcardId!: string;

  @PrimaryColumn({ type: 'uuid' })
  labelId!: string;

  @Column({ type: 'enum', enum: LabelSource })
  source!: LabelSource;

  @Column({ default: false })
  confirmedByUser!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => FlashCard, (flashcard) => flashcard.labelLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'flashcardId' })
  flashcard!: FlashCard;

  @ManyToOne(() => Label, (label) => label.flashcardLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'labelId' })
  label!: Label;
}
