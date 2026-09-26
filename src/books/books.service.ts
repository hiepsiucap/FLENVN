import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FlashCardStatus } from '../flashcards/flashcard.entity';
import { Book } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { ManagedImageService } from '../uploads/managed-image.service';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly managedImageService: ManagedImageService,
  ) {}

  private async validateParentBook(
    manager: EntityManager,
    userId: string,
    parentBookId: string,
    bookId?: string,
  ): Promise<void> {
    if (parentBookId === bookId) {
      throw new BadRequestException('A book cannot be its own parent');
    }

    const parent = await manager.findOne(Book, {
      where: { id: parentBookId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!parent) {
      throw new NotFoundException('Parent book not found');
    }
    if (parent.userId !== userId) {
      throw new ForbiddenException('You do not own the parent book');
    }
    if (parent.parentBookId !== null) {
      throw new BadRequestException('Sub-books cannot contain other books');
    }
  }

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

    const managedCover = createBookDto.coverImage
      ? await this.managedImageService.normalizeExternalUrl(
          userId,
          createBookDto.coverImage,
          'book',
        )
      : undefined;

    // Create book
    const book = this.bookRepository.create({
      ...createBookDto,
      userId,
      parentBookId: createBookDto.parentBookId ?? null,
      wordCount,
      coverImage: managedCover?.fileUrl || Book.DEFAULT_COVER_IMAGE_URL,
      coverImageKey: managedCover?.objectKey || 'images/logo.png',
    });

    const savedBook = await this.bookRepository.manager.transaction(
      async (manager) => {
        if (createBookDto.parentBookId) {
          await this.validateParentBook(
            manager,
            userId,
            createBookDto.parentBookId,
          );
        }
        return manager.save(Book, book);
      },
    );

    // Update user's subscription usage
    await this.subscriptionsService.updateUserUsage(userId, 1, wordCount);

    return savedBook;
  }

  async getBooks(userId: string): Promise<Book[]> {
    const books = await this.bookRepository.find({
      where: { userId },
      relations: { flashcards: { labelLinks: { label: true } } },
      order: { createdAt: 'DESC' },
    });
    return books.map((book) => this.prepareBookResponse(book));
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
      relations: { flashcards: { labelLinks: { label: true } } },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Check ownership unless book is public
    if (book.userId !== userId && !book.isPublic) {
      throw new ForbiddenException('You do not have access to this book');
    }

    const response = this.prepareBookResponse(book);
    if (book.userId !== userId) {
      response.parentBookId = null;
    }
    return response;
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

    let nextCoverImageKey: string | undefined;
    if (updateBookDto.coverImage !== undefined) {
      const managedCover = await this.managedImageService.normalizeExternalUrl(
        userId,
        updateBookDto.coverImage,
        'book',
      );
      updateBookDto.coverImage = managedCover.fileUrl;
      nextCoverImageKey = managedCover.objectKey;
    }

    // Calculate word count change if content is updated
    let nextWordCount: number | undefined;
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

      nextWordCount = newWordCount;
    }

    return this.bookRepository.manager.transaction(async (manager) => {
      const lockedBook = await manager.findOne(Book, {
        where: { id: bookId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedBook) {
        throw new NotFoundException('Book not found');
      }
      if (lockedBook.userId !== userId) {
        throw new ForbiddenException('You can only update your own books');
      }

      if (updateBookDto.parentBookId) {
        await this.validateParentBook(
          manager,
          userId,
          updateBookDto.parentBookId,
          bookId,
        );
        const childCount = await manager.count(Book, {
          where: { parentBookId: bookId },
        });
        if (childCount > 0) {
          throw new BadRequestException(
            'Move sub-books before moving this book under another book',
          );
        }
      }

      Object.assign(lockedBook, updateBookDto);
      if (nextCoverImageKey !== undefined) {
        lockedBook.coverImageKey = nextCoverImageKey;
      }
      if (nextWordCount !== undefined) {
        lockedBook.wordCount = nextWordCount;
      }
      return manager.save(Book, lockedBook);
    });
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
      const lockedBook = await manager.findOne(Book, {
        where: { id: bookId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedBook) {
        throw new NotFoundException('Book not found');
      }
      if (lockedBook.userId !== userId) {
        throw new ForbiddenException('You can only delete your own books');
      }
      const childCount = await manager.count(Book, {
        where: { parentBookId: bookId },
      });
      if (childCount > 0) {
        throw new BadRequestException(
          'Move or delete sub-books before deleting this book',
        );
      }

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
    const books = await this.bookRepository.find({
      where: { isPublic: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return books.map((book) => ({ ...book, parentBookId: null }));
  }

  // Helper method to count words
  private countWords(text: string): number {
    if (!text) return 0;
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private prepareBookResponse(book: Book): Book {
    book.flashcards = (book.flashcards ?? []).map((flashcard) => {
      flashcard.labels = (flashcard.labelLinks ?? []).map((link) => ({
        ...link.label,
        source: link.source,
        confirmedByUser: link.confirmedByUser,
      }));
      delete flashcard.labelLinks;
      return flashcard;
    });
    return book;
  }
}
