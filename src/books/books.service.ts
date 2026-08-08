import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FlashCardStatus } from '../flashcards/flashcard.entity';
import { Book } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async createBook(
    userId: string,
    createBookDto: CreateBookDto,
  ): Promise<Book> {
    // Check subscription limits
    const canAddBook = await this.subscriptionsService.canAddBook(userId);
    if (!canAddBook) {
      throw new BadRequestException('Book limit reached for your subscription');
    }

    // Calculate word count from content
    const wordCount = this.countWords(createBookDto.content || '');

    // Check if words fit within limit
    const canAddWords = await this.subscriptionsService.canAddWords(
      userId,
      wordCount,
    );
    if (!canAddWords) {
      throw new BadRequestException(
        'Word limit exceeded for your subscription',
      );
    }

    // Create book
    const book = this.bookRepository.create({
      ...createBookDto,
      userId,
      wordCount,
      coverImage: createBookDto.coverImage || Book.DEFAULT_COVER_IMAGE_URL,
    });

    const savedBook = await this.bookRepository.save(book);

    // Update user's subscription usage
    await this.subscriptionsService.updateUserUsage(userId, 1, wordCount);

    return savedBook;
  }

  async getBooks(userId: string): Promise<Book[]> {
    return this.bookRepository.find({
      where: { userId },
      relations: ['flashcards'],
      order: { createdAt: 'DESC' },
    });
  }

  async getDueReviewCounts(userId: string): Promise<
    Array<{
      bookId: string;
      title: string;
      dueForReview: number;
      totalCards: number;
    }>
  > {
    const rows = await this.bookRepository
      .createQueryBuilder('book')
      .leftJoin(
        'book.flashcards',
        'dueFlashcard',
        `
        (dueFlashcard.nextReviewDate IS NULL OR dueFlashcard.nextReviewDate <= :now)
        AND dueFlashcard.status != :masteredStatus
        `,
        {
          now: new Date(),
          masteredStatus: FlashCardStatus.MASTERED,
        },
      )
      .select('book.id', 'bookId')
      .addSelect('book.title', 'title')
      .addSelect('book.totalCards', 'totalCards')
      .addSelect('COUNT(dueFlashcard.id)', 'dueForReview')
      .where('book.userId = :userId', { userId })
      .groupBy('book.id')
      .orderBy('book.createdAt', 'DESC')
      .getRawMany<{
        bookId: string;
        title: string;
        totalCards: number;
        dueForReview: string;
      }>();

    return rows.map((row) => ({
      bookId: row.bookId,
      title: row.title,
      totalCards: Number(row.totalCards),
      dueForReview: Number.parseInt(row.dueForReview, 10),
    }));
  }

  async getBookById(bookId: string, userId: string): Promise<Book> {
    const book = await this.bookRepository.findOne({
      where: { id: bookId },
      relations: ['flashcards'],
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Check ownership unless book is public
    if (book.userId !== userId && !book.isPublic) {
      throw new ForbiddenException('You do not have access to this book');
    }

    return book;
  }

  async updateBook(
    bookId: string,
    userId: string,
    updateBookDto: UpdateBookDto,
  ): Promise<Book> {
    const book = await this.bookRepository.findOne({
      where: { id: bookId },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Verify ownership
    if (book.userId !== userId) {
      throw new ForbiddenException('You can only update your own books');
    }

    // Calculate word count change if content is updated
    if (updateBookDto.content !== undefined) {
      const newWordCount = this.countWords(updateBookDto.content);
      const wordDifference = newWordCount - book.wordCount;

      // If words increased, check subscription limit
      if (wordDifference > 0) {
        const canAddWords = await this.subscriptionsService.canAddWords(
          userId,
          wordDifference,
        );
        if (!canAddWords) {
          throw new BadRequestException(
            'Word limit exceeded for your subscription',
          );
        }

        // Update subscription usage
        await this.subscriptionsService.updateUserUsage(
          userId,
          0,
          wordDifference,
        );
      } else if (wordDifference < 0) {
        // If words decreased, reduce usage (optional: implement later)
        await this.subscriptionsService.updateUserUsage(
          userId,
          0,
          wordDifference,
        );
      }

      book.wordCount = newWordCount;
    }

    // Update other fields
    Object.assign(book, updateBookDto);
    return this.bookRepository.save(book);
  }

  async deleteBook(
    bookId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const book = await this.bookRepository.findOne({
      where: { id: bookId },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Verify ownership
    if (book.userId !== userId) {
      throw new ForbiddenException('You can only delete your own books');
    }

    await this.bookRepository.manager.transaction(async (manager) => {
      await manager.query(
        `
        DELETE FROM sessions
        WHERE "flashcardId" IN (
          SELECT id FROM flashcards WHERE "bookId" = $1
        )
        `,
        [bookId],
      );

      await manager.query('DELETE FROM flashcards WHERE "bookId" = $1', [
        bookId,
      ]);

      await manager.delete(Book, { id: bookId });

      await manager.query(
        `
        UPDATE users
        SET
          "booksCount" = GREATEST("booksCount" - 1, 0),
          "totalWordsUsed" = GREATEST("totalWordsUsed" - $2, 0)
        WHERE id = $1
        `,
        [userId, book.wordCount],
      );
    });

    return { message: 'Book deleted successfully' };
  }

  async getPublicBooks(
    limit: number = 10,
    offset: number = 0,
  ): Promise<Book[]> {
    return this.bookRepository.find({
      where: { isPublic: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  // Helper method to count words
  private countWords(text: string): number {
    if (!text) return 0;
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }
}
