import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BooksService } from '../books/books.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { PartOfSpeech } from '../flashcards/part-of-speech.enum';
import { AiConversation } from './ai-conversation.entity';
import { AiMessage } from './ai-message.entity';
import {
  SaveVocabularyDto,
  VocabularyCandidateType,
} from './dto/collect-vocabulary.dto';
import {
  VocabularyCandidate,
  VocabularyCollectorModelService,
} from './vocabulary-collector-model.service';

@Injectable()
export class VocabularyCollectorService {
  constructor(
    @InjectRepository(AiConversation)
    private readonly conversations: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messages: Repository<AiMessage>,
    private readonly books: BooksService,
    private readonly flashcards: FlashcardsService,
    private readonly model: VocabularyCollectorModelService,
  ) {}

  async discoverConversation(userId: string, conversationId: string) {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const newestFirst = await this.messages.find({
      where: { conversationId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 100,
    });
    if (!newestFirst.length)
      throw new BadRequestException('Conversation has no completed messages');
    const selected: AiMessage[] = [];
    let size = 0;
    for (const message of newestFirst) {
      if (size + message.content.length > 12000 && selected.length) break;
      selected.push(message);
      size += message.content.length;
    }
    const input = selected
      .reverse()
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n')
      .slice(-12000);
    const candidates = await this.model.discover(
      input,
      'conversation',
      conversation.targetLanguage,
    );
    return this.enrich(
      userId,
      candidates.map((candidate) => ({
        ...candidate,
        example:
          candidate.example &&
          input
            .toLocaleLowerCase()
            .includes(candidate.example.toLocaleLowerCase())
            ? candidate.example
            : undefined,
      })),
      'conversation',
    );
  }

  async discoverTopic(userId: string, topic: string, targetLanguage = 'vi') {
    if (!topic.trim()) throw new BadRequestException('Topic is required');
    return this.enrich(
      userId,
      await this.model.discover(topic.trim(), 'topic', targetLanguage),
      'topic',
    );
  }

  private async enrich(
    userId: string,
    candidates: VocabularyCandidate[],
    source: 'conversation' | 'topic',
  ) {
    const seen = new Set<string>();
    const results: Array<
      VocabularyCandidate & {
        source: 'conversation' | 'topic';
        alreadyExists: boolean;
        existingFlashcardId: string | null;
        existingBookId: string | null;
        existingBookTitle: string | null;
      }
    > = [];
    for (const candidate of candidates.slice(0, 20)) {
      const key = candidate.text
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]+$/gu, '')
        .replace(/\s+/g, ' ');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const existing = await this.flashcards.findByWord(
        userId,
        candidate.text.trim(),
      );
      results.push({
        ...candidate,
        source,
        alreadyExists: !!existing,
        existingFlashcardId: existing?.id ?? null,
        existingBookId: existing?.bookId ?? null,
        existingBookTitle: existing?.book?.title ?? null,
      });
    }
    return { candidates: results };
  }

  async save(userId: string, dto: SaveVocabularyDto) {
    const book = await this.books.getBookById(dto.bookId, userId);
    if (!book || book.userId !== userId)
      throw new NotFoundException('Book not found');
    if (!dto.candidates?.length || dto.candidates.length > 20) {
      throw new BadRequestException('Select between 1 and 20 candidates');
    }
    const results: Array<{
      text: string;
      status: 'saved' | 'duplicate' | 'failed';
      flashcardId?: string;
      error?: string;
    }> = [];
    const seen = new Set<string>();
    for (const candidate of dto.candidates) {
      const text = candidate.text.trim();
      const key = text.toLowerCase();
      if (
        !text ||
        !candidate.translation.trim() ||
        !candidate.definition.trim() ||
        !Object.values(VocabularyCandidateType).includes(candidate.type)
      ) {
        results.push({
          text,
          status: 'failed',
          error: 'Required candidate fields are invalid',
        });
        continue;
      }
      if (seen.has(key)) {
        results.push({ text, status: 'duplicate' });
        continue;
      }
      seen.add(key);
      try {
        const existing = await this.flashcards.findByWord(userId, text);
        if (existing) {
          results.push({ text, status: 'duplicate', flashcardId: existing.id });
          continue;
        }
        const card = await this.flashcards.createFlashcard(userId, {
          word: text,
          bookId: dto.bookId,
          partOfSpeech:
            candidate.type === VocabularyCandidateType.WORD
              ? undefined
              : (candidate.type as unknown as PartOfSpeech),
          translation: candidate.translation.trim(),
          definition: candidate.definition.trim(),
          example: candidate.example?.trim() || undefined,
        });
        results.push({ text, status: 'saved', flashcardId: card.id });
      } catch (error) {
        if (error instanceof ConflictException) {
          results.push({ text, status: 'duplicate' });
        } else {
          results.push({
            text,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Save failed',
          });
        }
      }
    }
    return {
      saved: results.filter((result) => result.status === 'saved').length,
      duplicates: results.filter((result) => result.status === 'duplicate')
        .length,
      failed: results.filter((result) => result.status === 'failed').length,
      results,
    };
  }
}
