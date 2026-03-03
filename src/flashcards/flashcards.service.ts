import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashCard, FlashCardStatus } from './flashcard.entity';
import { CreateFlashcardDto } from './dto/create-flashcard.dto';
import { UpdateFlashcardDto } from './dto/update-flashcard.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BooksService } from '../books/books.service';

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectRepository(FlashCard)
    private readonly flashcardRepository: Repository<FlashCard>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly booksService: BooksService,
  ) {}

  async createFlashcard(
    userId: string,
    createFlashcardDto: CreateFlashcardDto,
  ): Promise<FlashCard> {
    // Check subscription limits (each flashcard counts as words)
    const wordCount = this.countWords(
      createFlashcardDto.definition ||
        createFlashcardDto.translation ||
        createFlashcardDto.example ||
        '',
    );

    const canAddWords = await this.subscriptionsService.canAddWords(
      userId,
      wordCount,
    );
    if (!canAddWords) {
      throw new BadRequestException(
        'Word limit exceeded for your subscription',
      );
    }

    // Verify book ownership if bookId provided
    if (createFlashcardDto.bookId) {
      const book = await this.booksService.getBookById(
        createFlashcardDto.bookId,
        userId,
      );
      if (!book) {
        throw new NotFoundException('Book not found');
      }
    }

    // Create flashcard
    const flashcard = this.flashcardRepository.create({
      ...createFlashcardDto,
      userId,
      easeFactor: 2.5, // SM-2 algorithm default
      interval: 1,
      repetitions: 0,
      status: FlashCardStatus.NEW,
    });

    const savedFlashcard = await this.flashcardRepository.save(flashcard);

    // Update subscription usage
    await this.subscriptionsService.updateUserUsage(userId, 0, wordCount);

    // Increment book's total cards if bookId provided
    if (createFlashcardDto.bookId) {
      await this.flashcardRepository.query(
        `UPDATE books SET totalCards = totalCards + 1 WHERE id = $1`,
        [createFlashcardDto.bookId],
      );
    }

    return savedFlashcard;
  }

  async getFlashcards(
    userId: string,
    bookId?: string,
    status?: FlashCardStatus,
  ): Promise<FlashCard[]> {
    const query = this.flashcardRepository
      .createQueryBuilder('fc')
      .where('fc.userId = :userId', { userId });

    if (bookId) {
      query.andWhere('fc.bookId = :bookId', { bookId });
    }

    if (status) {
      query.andWhere('fc.status = :status', { status });
    }

    return query.orderBy('fc.nextReviewDate', 'ASC').addOrderBy('fc.createdAt', 'DESC').getMany();
  }

  async getFlashcardById(flashcardId: string, userId: string): Promise<FlashCard> {
    const flashcard = await this.flashcardRepository.findOne({
      where: { id: flashcardId },
    });

    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }

    if (flashcard.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this flashcard',
      );
    }

    return flashcard;
  }

  async updateFlashcard(
    flashcardId: string,
    userId: string,
    updateFlashcardDto: UpdateFlashcardDto,
  ): Promise<FlashCard> {
    const flashcard = await this.getFlashcardById(flashcardId, userId);

    // Update fields
    Object.assign(flashcard, updateFlashcardDto);
    return this.flashcardRepository.save(flashcard);
  }

  async deleteFlashcard(
    flashcardId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const flashcard = await this.getFlashcardById(flashcardId, userId);

    const wordCount = this.countWords(
      flashcard.definition || flashcard.translation || flashcard.example || '',
    );

    // Reduce subscription usage
    await this.subscriptionsService.updateUserUsage(userId, 0, -wordCount);

    // Decrement book's total cards if bookId provided
    if (flashcard.bookId) {
      await this.flashcardRepository.query(
        `UPDATE books SET totalCards = totalCards - 1 WHERE id = $1`,
        [flashcard.bookId],
      );
    }

    await this.flashcardRepository.remove(flashcard);
    return { message: 'Flashcard deleted successfully' };
  }

  // Spaced repetition logic (SM-2 algorithm)
  async reviewFlashcard(
    flashcardId: string,
    userId: string,
    quality: number, // 0-5, where 3+ = success
  ): Promise<FlashCard> {
    const flashcard = await this.getFlashcardById(flashcardId, userId);

    if (quality < 0 || quality > 5) {
      throw new BadRequestException('Quality must be between 0 and 5');
    }

    // SM-2 calculation
    let easeFactor = flashcard.easeFactor;
    easeFactor =
      easeFactor +
      (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor); // Minimum ease factor

    let interval = 1;
    let repetitions = 1;

    if (quality >= 3) {
      // Correct answer
      if (flashcard.repetitions === 0) {
        interval = 1;
      } else if (flashcard.repetitions === 1) {
        interval = 3;
      } else {
        interval = Math.round(flashcard.interval * easeFactor);
      }
      repetitions = flashcard.repetitions + 1;
      flashcard.status = FlashCardStatus.REVIEWING;
    } else {
      // Wrong answer
      repetitions = 1;
      interval = 1;
      flashcard.status = FlashCardStatus.LEARNING;
    }

    // Update flashcard
    flashcard.easeFactor = easeFactor;
    flashcard.interval = interval;
    flashcard.repetitions = repetitions;

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    flashcard.nextReviewDate = nextReviewDate;

    return this.flashcardRepository.save(flashcard);
  }

  // Get cards due for review
  async getCardsForReview(userId: string, limit: number = 20): Promise<FlashCard[]> {
    const now = new Date();
    return this.flashcardRepository
      .createQueryBuilder('fc')
      .where('fc.userId = :userId', { userId })
      .andWhere('(fc.nextReviewDate IS NULL OR fc.nextReviewDate <= :now)', {
        now,
      })
      .andWhere('fc.status != :status', { status: FlashCardStatus.MASTERED })
      .orderBy('fc.nextReviewDate', 'ASC')
      .limit(limit)
      .getMany();
  }

  // Mark flashcard as mastered
  async markAsMastered(
    flashcardId: string,
    userId: string,
  ): Promise<FlashCard> {
    const flashcard = await this.getFlashcardById(flashcardId, userId);
    flashcard.status = FlashCardStatus.MASTERED;
    flashcard.nextReviewDate = null;
    return this.flashcardRepository.save(flashcard);
  }

  async getStats(userId: string): Promise<{
    total: number;
    new: number;
    learning: number;
    reviewing: number;
    mastered: number;
    dueForReview: number;
  }> {
    const total = await this.flashcardRepository.countBy({ userId });

    const [stats] = await this.flashcardRepository.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'new') as new,
        COUNT(*) FILTER (WHERE status = 'learning') as learning,
        COUNT(*) FILTER (WHERE status = 'reviewing') as reviewing,
        COUNT(*) FILTER (WHERE status = 'mastered') as mastered,
        COUNT(*) FILTER (WHERE (nextReviewDate IS NULL OR nextReviewDate <= NOW())) as dueForReview
      FROM flashcards
      WHERE userId = $1
      `,
      [userId],
    );

    return {
      total,
      new: parseInt(stats.new || 0),
      learning: parseInt(stats.learning || 0),
      reviewing: parseInt(stats.reviewing || 0),
      mastered: parseInt(stats.mastered || 0),
      dueForReview: parseInt(stats.dueForReview || 0),
    };
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }
}
