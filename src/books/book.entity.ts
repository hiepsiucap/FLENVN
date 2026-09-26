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
import { FlashCard } from '../flashcards/flashcard.entity';
import { User } from '../users/user.entity';

@Entity('books')
export class Book {
  static readonly DEFAULT_COVER_IMAGE_URL =
    'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/logo.png';

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Index('IDX_books_parentBookId')
  @Column({ type: 'uuid', nullable: true })
  parentBookId!: string | null;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
    default: Book.DEFAULT_COVER_IMAGE_URL,
  })
  coverImage!: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverImageKey!: string | null;

  @Column({ type: 'text', nullable: true })
  content!: string | null; // Main book content/text

  @Column({ type: 'varchar', nullable: true })
  fileUrl!: string | null;

  @Column({ default: 0 })
  wordCount!: number; // Total words in the book

  @Column({ default: 0 })
  totalCards!: number; // Total flashcards created from this book

  @Column({ default: true })
  isPublic!: boolean;

  @Index()
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relationships
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Book, (book) => book.subBooks, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'parentBookId' })
  parentBook!: Book | null;

  @OneToMany(() => Book, (book) => book.parentBook)
  subBooks!: Book[];

  @OneToMany(() => FlashCard, (flashcard) => flashcard.book, {
    onDelete: 'CASCADE',
  })
  flashcards!: FlashCard[];
}
