import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { UsersService } from '../users/users.service';
import { CreatePracticeSessionDto } from './dto/create-practice-session.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { PracticeGameResult } from './practice-game-result.entity';
import { PracticeSession } from './practice-session.entity';
import { Session, SessionResult, SessionType } from './session.entity';
import { normalizeSessionScore } from './session-score';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(PracticeSession)
    private readonly practiceSessionRepository: Repository<PracticeSession>,
    @InjectRepository(PracticeGameResult)
    private readonly practiceGameResultRepository: Repository<PracticeGameResult>,
    private readonly flashcardsService: FlashcardsService,
    private readonly usersService: UsersService,
  ) {}

  async createSession(
    userId: string,
    flashcardId: string,
    createSessionDto: CreateSessionDto,
  ): Promise<Session> {
    await this.flashcardsService.getFlashcardById(flashcardId, userId);

    const savedSession = await this.sessionRepository.save(
      this.sessionRepository.create({
        ...createSessionDto,
        userId,
        flashcardId,
        score: normalizeSessionScore(
          createSessionDto.result,
          createSessionDto.score,
        ),
      }),
    );
    await this.usersService.recordProgress(userId, savedSession.score);

    return savedSession;
  }

  async createPracticeSession(
    userId: string,
    createPracticeSessionDto: CreatePracticeSessionDto,
  ): Promise<PracticeSession> {
    const flashcardIds = createPracticeSessionDto.flashcards.map(
      (flashcard) => flashcard.flashcardId,
    );
    const uniqueFlashcardIds = Array.from(new Set(flashcardIds));
    if (uniqueFlashcardIds.length !== flashcardIds.length) {
      throw new BadRequestException(
        'Each flashcard can only appear once in a practice session',
      );
    }

    for (const flashcardId of uniqueFlashcardIds) {
      const flashcard = await this.flashcardsService.getFlashcardById(
        flashcardId,
        userId,
      );

      if (
        createPracticeSessionDto.bookId &&
        flashcard.bookId !== createPracticeSessionDto.bookId
      ) {
        throw new ForbiddenException(
          'Flashcard does not belong to the selected book',
        );
      }
    }

    const flattenedGames = createPracticeSessionDto.flashcards.flatMap(
      (flashcard) =>
        flashcard.games.map((game) => ({
          flashcardId: flashcard.flashcardId,
          ...game,
        })),
    );
    const scoredGames = flattenedGames.map((game) => ({
      ...game,
      score: normalizeSessionScore(game.result, game.score),
    }));
    const correctGames = scoredGames.filter(
      (game) => game.result === SessionResult.CORRECT,
    ).length;
    const incorrectGames = scoredGames.filter(
      (game) => game.result === SessionResult.INCORRECT,
    ).length;
    const skippedGames = scoredGames.filter(
      (game) => game.result === SessionResult.SKIPPED,
    ).length;
    const score = scoredGames.reduce((total, game) => total + game.score, 0);
    const accuracy =
      scoredGames.length > 0
        ? Math.round((correctGames / scoredGames.length) * 10000) / 100
        : 0;

    const practiceSession = await this.practiceSessionRepository.save(
      this.practiceSessionRepository.create({
        userId,
        bookId: createPracticeSessionDto.bookId || null,
        totalFlashcards: createPracticeSessionDto.flashcards.length,
        totalGames: scoredGames.length,
        correctGames,
        incorrectGames,
        skippedGames,
        score,
        accuracy,
        durationMs: createPracticeSessionDto.durationMs ?? null,
      }),
    );

    const gameResults = scoredGames.map((game) =>
      this.practiceGameResultRepository.create({
        practiceSessionId: practiceSession.id,
        flashcardId: game.flashcardId,
        gameType: game.gameType,
        result: game.result,
        responseTime: game.responseTime ?? null,
        score: game.score,
      }),
    );

    await this.practiceGameResultRepository.save(gameResults);
    await this.usersService.recordProgress(userId, score);

    for (const flashcard of createPracticeSessionDto.flashcards) {
      await this.flashcardsService.reviewFlashcard(
        flashcard.flashcardId,
        userId,
        flashcard.quality,
      );
    }

    return this.practiceSessionRepository.findOneOrFail({
      where: { id: practiceSession.id },
      relations: { gameResults: true },
    });
  }

  async getSessionHistory(
    userId: string,
    flashcardId?: string,
    days?: number,
  ): Promise<Session[]> {
    const query = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.userId = :userId', { userId });

    if (flashcardId) {
      query.andWhere('session.flashcardId = :flashcardId', { flashcardId });
    }

    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query.andWhere('session.createdAt >= :startDate', { startDate });
    }

    return query.orderBy('session.createdAt', 'DESC').getMany();
  }

  async getStudyStats(
    userId: string,
    days: number = 7,
  ): Promise<{
    totalSessions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    skipped: number;
    accuracy: number;
    averageResponseTime: number;
    sessionsByType: Record<SessionType, number>;
    dailyStats: Array<{
      date: string;
      sessions: number;
      correct: number;
      incorrect: number;
    }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    const [sessions, practiceSessions] = await Promise.all([
      this.sessionRepository.find({
        where: { userId, createdAt: Between(startDate, endDate) },
      }),
      this.practiceSessionRepository.find({
        where: { userId, createdAt: Between(startDate, endDate) },
        relations: { gameResults: true },
      }),
    ]);

    const practiceGameResults = practiceSessions.flatMap(
      (practiceSession) => practiceSession.gameResults,
    );
    const correctAnswers =
      sessions.filter((session) => session.result === SessionResult.CORRECT)
        .length +
      practiceSessions.reduce(
        (total, practiceSession) => total + practiceSession.correctGames,
        0,
      );
    const incorrectAnswers =
      sessions.filter((session) => session.result === SessionResult.INCORRECT)
        .length +
      practiceSessions.reduce(
        (total, practiceSession) => total + practiceSession.incorrectGames,
        0,
      );
    const skipped =
      sessions.filter((session) => session.result === SessionResult.SKIPPED)
        .length +
      practiceSessions.reduce(
        (total, practiceSession) => total + practiceSession.skippedGames,
        0,
      );
    const totalAnswers =
      sessions.length +
      practiceSessions.reduce(
        (total, practiceSession) => total + practiceSession.totalGames,
        0,
      );
    const responseTimes = [
      ...sessions
        .map((session) => session.responseTime)
        .filter(
          (responseTime): responseTime is number => responseTime !== null,
        ),
      ...practiceGameResults
        .map((game) => game.responseTime)
        .filter(
          (responseTime): responseTime is number => responseTime !== null,
        ),
    ];
    const sessionsByType: Record<SessionType, number> = {
      [SessionType.REVIEW]: 0,
      [SessionType.LEARN]: 0,
      [SessionType.PRACTICE]: practiceSessions.length,
    };
    const dailyStatsMap = new Map<
      string,
      { sessions: number; correct: number; incorrect: number }
    >();

    sessions.forEach((session) => {
      sessionsByType[session.type]++;
      const stats = this.getDailyStats(dailyStatsMap, session.createdAt);
      stats.sessions++;
      if (session.result === SessionResult.CORRECT) stats.correct++;
      if (session.result === SessionResult.INCORRECT) stats.incorrect++;
    });

    practiceSessions.forEach((practiceSession) => {
      const stats = this.getDailyStats(
        dailyStatsMap,
        practiceSession.createdAt,
      );
      stats.sessions++;
      stats.correct += practiceSession.correctGames;
      stats.incorrect += practiceSession.incorrectGames;
    });

    return {
      totalSessions: sessions.length + practiceSessions.length,
      correctAnswers,
      incorrectAnswers,
      skipped,
      accuracy:
        totalAnswers > 0
          ? Math.round((correctAnswers / totalAnswers) * 10000) / 100
          : 0,
      averageResponseTime:
        responseTimes.length > 0
          ? Math.round(
              responseTimes.reduce((total, value) => total + value, 0) /
                responseTimes.length,
            )
          : 0,
      sessionsByType,
      dailyStats: Array.from(dailyStatsMap.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async getStreakStats(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastStudyDate: Date | null;
  }> {
    const [sessions, practiceSessions] = await Promise.all([
      this.sessionRepository.find({ where: { userId } }),
      this.practiceSessionRepository.find({ where: { userId } }),
    ]);
    const studyDates = [
      ...sessions.map((session) => session.createdAt),
      ...practiceSessions.map((practiceSession) => practiceSession.createdAt),
    ].sort((a, b) => b.getTime() - a.getTime());

    if (studyDates.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastStudyDate: null,
      };
    }

    const activeDateKeys = new Set(
      studyDates.map((date) => this.toDateKey(date)),
    );
    const today = this.startOfDay(new Date());
    const lastStudyDate = studyDates[0];
    const daysSinceLastStudy = Math.floor(
      (today.getTime() - this.startOfDay(lastStudyDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    let currentStreak = 0;
    if (daysSinceLastStudy <= 1) {
      const checkDate = new Date(today);
      while (activeDateKeys.has(this.toDateKey(checkDate))) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    return {
      currentStreak,
      longestStreak: this.calculateLongestStreak(studyDates),
      lastStudyDate,
    };
  }

  async deleteSession(
    sessionId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You cannot delete this session');
    }

    await this.sessionRepository.remove(session);
    return { message: 'Session deleted successfully' };
  }

  private getDailyStats(
    dailyStatsMap: Map<
      string,
      { sessions: number; correct: number; incorrect: number }
    >,
    date: Date,
  ) {
    const dateKey = this.toDateKey(date);
    const stats = dailyStatsMap.get(dateKey) || {
      sessions: 0,
      correct: 0,
      incorrect: 0,
    };
    dailyStatsMap.set(dateKey, stats);
    return stats;
  }

  private calculateLongestStreak(studyDates: Date[]): number {
    const sortedDateKeys = Array.from(
      new Set(studyDates.map((date) => this.toDateKey(date))),
    ).sort((a, b) => b.localeCompare(a));

    if (sortedDateKeys.length === 0) return 0;

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedDateKeys.length; i++) {
      const currentDate = new Date(sortedDateKeys[i - 1]);
      const previousDate = new Date(sortedDateKeys[i]);
      const daysDiff = Math.floor(
        (currentDate.getTime() - previousDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysDiff === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return longestStreak;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
