import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FlashCard } from '../flashcards/flashcard.entity';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  author: string;

  @Column({ nullable: true })
  coverImage: string;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ default: 0 })
  totalCards: number;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => FlashCard, flashcard => flashcard.book)
  flashcards: FlashCard[];
}
