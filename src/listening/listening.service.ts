import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FlashCard } from '../flashcards/flashcard.entity';
import { FlashcardAudioService } from '../flashcards/flashcard-audio.service';
import { ListeningSet } from './listening-set.entity';
import { ListeningModelService } from './listening-model.service';
import { createHash } from 'crypto';
import { checkListeningAnswer } from './listening-content';
import { AnswerListeningDto, GenerateListeningDto } from './listening.dto';

@Injectable()
export class ListeningService {
  constructor(
    @InjectRepository(FlashCard) private readonly cards: Repository<FlashCard>,
    @InjectRepository(ListeningSet)
    private readonly sets: Repository<ListeningSet>,
    private readonly model: ListeningModelService,
    private readonly audio: FlashcardAudioService,
  ) {}
  private readonly sentenceRequests = new Map<
    string,
    Promise<{ url: string }>
  >();
  async sentenceAudio(userId: string, id: string): Promise<{ url: string }> {
    const card = await this.cards.findOne({ where: { id, userId } });
    if (!card || !card.example?.trim())
      throw new NotFoundException('Example sentence not found');
    if (card.exampleAudioUrl) return { url: card.exampleAudioUrl };
    const key = `${userId}:${id}:${card.example}`;
    const existing = this.sentenceRequests.get(key);
    if (existing) return existing;
    const task = (async () => {
      const url = await this.audio.createAudioUrl(userId, card.example!);
      if (!url)
        throw new ServiceUnavailableException(
          'Sentence audio is temporarily unavailable',
        );
      const update = await this.cards.update(
        { id, userId, example: card.example! },
        { exampleAudioUrl: url },
      );
      if (!update.affected)
        throw new BadRequestException(
          'The sentence changed. Refresh and try again.',
        );
      return { url };
    })();
    this.sentenceRequests.set(key, task);
    try {
      return await task;
    } finally {
      this.sentenceRequests.delete(key);
    }
  }
  private readonly pending = new Set<string>();
  private readonly logger = new Logger(ListeningService.name);

  async generate(userId: string, dto: GenerateListeningDto) {
    const owned = await this.cards.find({
      where: { id: In(dto.flashcardIds), userId },
      select: { id: true, word: true },
    });
    if (
      owned.length !== dto.flashcardIds.length ||
      owned.some((card) => !card.word.trim())
    )
      throw new NotFoundException('Choose valid cards from your own books');
    const vocabulary = owned
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((card) => ({ id: card.id, word: card.word.trim() }));
    const cacheKey = createHash('sha256')
      .update(
        JSON.stringify({
          version: 1,
          vocabulary,
          game: dto.game,
          difficulty: dto.difficulty,
        }),
      )
      .digest('hex');
    let round = await this.sets.findOne({ where: { userId, cacheKey } });
    if (
      round &&
      (round.status === 'ready' ||
        this.pending.has(round.id) ||
        (round.status === 'generating' &&
          Date.now() - round.updatedAt.getTime() < 180_000))
    )
      return this.publicRound(round);
    if (!round) {
      try {
        round = await this.sets.save(
          this.sets.create({
            userId,
            cacheKey,
            game: dto.game,
            difficulty: dto.difficulty,
            status: 'generating',
            questions: [],
          }),
        );
      } catch (error) {
        if ((error as { code?: string }).code !== '23505') throw error;
        const existing = await this.sets.findOne({
          where: { userId, cacheKey },
        });
        if (!existing) throw error;
        return this.publicRound(existing);
      }
    } else {
      round.status = 'generating';
      round.questions = [];
      round = await this.sets.save(round);
    }
    this.pending.add(round.id);
    const generated = round;
    void this.build(
      generated,
      vocabulary.map((card) => card.word),
    )
      .catch(() => {
        this.logger.warn('Could not persist listening generation status');
      })
      .finally(() => this.pending.delete(generated.id));
    return this.publicRound(round);
  }

  private async build(round: ListeningSet, words: string[]) {
    try {
      const questions = await this.model.generate(
        words,
        round.game,
        round.difficulty,
      );
      // Five independent questions run concurrently; dialogue turns retain order.
      const complete = await Promise.all(
        questions.map(async (question) => {
          const audioUrls: string[] = [];
          for (const turn of question.script) {
            const url = await this.audio.createAudioUrl(
              round.userId,
              turn.text,
              turn.speaker === 'B' ? 'Matthew' : 'Joanna',
            );
            if (!url) throw new Error('Audio unavailable');
            audioUrls.push(url);
          }
          return { ...question, audioUrls };
        }),
      );
      round.questions = complete;
      round.status = 'ready';
      await this.sets.save(round);
    } catch {
      round.questions = [];
      round.status = 'failed';
      await this.sets.save(round);
    }
  }

  private publicRound(round: ListeningSet) {
    const stale =
      round.status === 'generating' &&
      !this.pending.has(round.id) &&
      Date.now() - round.updatedAt.getTime() >= 180_000;
    const status = stale ? 'failed' : round.status;
    return {
      id: round.id,
      game: round.game,
      difficulty: round.difficulty,
      status,
      questions:
        status === 'ready'
          ? round.questions.map((question) => ({
              id: question.id,
              prompt: question.prompt,
              choices: question.choices,
              audioUrls: question.audioUrls,
            }))
          : [],
    };
  }
  private async ownedRound(userId: string, id: string) {
    const round = await this.sets.findOne({ where: { id, userId } });
    if (!round) throw new NotFoundException('Listening round not found');
    return round;
  }
  async get(userId: string, id: string) {
    return this.publicRound(await this.ownedRound(userId, id));
  }
  async answer(userId: string, id: string, dto: AnswerListeningDto) {
    const round = await this.ownedRound(userId, id);
    if (round.status !== 'ready')
      throw new BadRequestException('This round is not ready');
    const question = round.questions.find((item) => item.id === dto.questionId);
    if (!question) throw new NotFoundException('Question not found');
    const correct = checkListeningAnswer(question, dto.answer);
    return {
      questionId: question.id,
      correct,
      score: correct ? 100 : 0,
      correctAnswer: question.choices
        ? question.choices[question.answerIndex!]
        : question.acceptedAnswers![0],
      transcript: question.script
        .map((turn) => `${turn.speaker}: ${turn.text}`)
        .join('\n'),
      explanation: question.explanation,
    };
  }
}
