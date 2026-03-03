import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async createBook(userId: string, createBookDto: CreateBookDto): Promise<Book> {
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
      throw new ForbiddenException(
        'You do not have access to this book',
      );
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

  async deleteBook(bookId: string, userId: string): Promise<{ message: string }> {
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

    // Reduce subscription usage when deleting
    await this.subscriptionsService.updateUserUsage(userId, -1, -book.wordCount);

    await this.bookRepository.remove(book);
    return { message: 'Book deleted successfully' };
  }

  async getPublicBooks(limit: number = 10, offset: number = 0): Promise<Book[]> {
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
      .filter(word => word.length > 0).length;
  }
}
