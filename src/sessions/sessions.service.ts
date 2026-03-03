import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Session, SessionType, SessionResult } from './session.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { FlashcardsService } from '../flashcards/flashcards.service';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly flashcardsService: FlashcardsService,
  ) {}

  async createSession(
    userId: string,
    flashcardId: string,
    createSessionDto: CreateSessionDto,
  ): Promise<Session> {
    // Verify flashcard ownership
    await this.flashcardsService.getFlashcardById(flashcardId, userId);

    // Create session
    const session = this.sessionRepository.create({
      ...createSessionDto,
      userId,
      flashcardId,
      score: createSessionDto.score || 0,
    });

    return this.sessionRepository.save(session);
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

    const sessions = await this.sessionRepository.find({
      where: {
        userId,
        createdAt: Between(startDate, new Date()),
      },
    });

    const totalSessions = sessions.length;
    const correctAnswers = sessions.filter(
      s => s.result === SessionResult.CORRECT,
    ).length;
    const incorrectAnswers = sessions.filter(
      s => s.result === SessionResult.INCORRECT,
    ).length;
    const skipped = sessions.filter(
      s => s.result === SessionResult.SKIPPED,
    ).length;

    const accuracy = totalSessions > 0 ? (correctAnswers / totalSessions) * 100 : 0;
    const responseTimes = sessions
      .filter(s => s.responseTime)
      .map(s => s.responseTime);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    // Count by type
    const sessionsByType: Record<SessionType, number> = {
      [SessionType.REVIEW]: 0,
      [SessionType.LEARN]: 0,
      [SessionType.PRACTICE]: 0,
    };

    sessions.forEach(s => {
      sessionsByType[s.type]++;
    });

    // Daily stats
    const dailyStatsMap = new Map<
      string,
      { sessions: number; correct: number; incorrect: number }
    >();

    sessions.forEach(session => {
      const dateKey = session.createdAt.toISOString().split('T')[0];
      const stats = dailyStatsMap.get(dateKey);
      if (!stats) {
        const newStats = {
          sessions: 0,
          correct: 0,
          incorrect: 0,
        };
        newStats.sessions++;
        if (session.result === SessionResult.CORRECT) {
          newStats.correct++;
        } else if (session.result === SessionResult.INCORRECT) {
          newStats.incorrect++;
        }
        dailyStatsMap.set(dateKey, newStats);
      } else {
        stats.sessions++;
        if (session.result === SessionResult.CORRECT) {
          stats.correct++;
        } else if (session.result === SessionResult.INCORRECT) {
          stats.incorrect++;
        }
        dailyStatsMap.set(dateKey, stats);
      }
    });

    const dailyStats = Array.from(dailyStatsMap.entries())
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSessions,
      correctAnswers,
      incorrectAnswers,
      skipped,
      accuracy: Math.round(accuracy * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      sessionsByType,
      dailyStats,
    };
  }

  async getStreakStats(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastStudyDate: Date | null;
  }> {
    const sessions = await this.sessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (sessions.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastStudyDate: null,
      };
    }

    const lastStudyDate = sessions[0].createdAt;

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    const lastStudyDateOnly = new Date(
      lastStudyDate.getFullYear(),
      lastStudyDate.getMonth(),
      lastStudyDate.getDate(),
    );
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    // Check if user studied today or yesterday
    const daysDiff = Math.floor(
      (todayOnly.getTime() - lastStudyDateOnly.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff > 1) {
      return {
        currentStreak: 0,
        longestStreak: this.calculateLongestStreak(sessions),
        lastStudyDate,
      };
    }

    // Calculate streak
    const sessionsByDate = new Map<string, boolean>();
    sessions.forEach(session => {
      const dateKey = session.createdAt.toISOString().split('T')[0];
      sessionsByDate.set(dateKey, true);
    });

    let checkDate = new Date(todayOnly);
    currentStreak = 0;

    while (sessionsByDate.has(checkDate.toISOString().split('T')[0])) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      currentStreak,
      longestStreak: this.calculateLongestStreak(sessions),
      lastStudyDate,
    };
  }

  async deleteSession(sessionId: string, userId: string): Promise<{ message: string }> {
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

  private calculateLongestStreak(sessions: Session[]): number {
    if (sessions.length === 0) return 0;

    const sessionsByDate = new Map<string, boolean>();
    sessions.forEach(session => {
      const dateKey = session.createdAt.toISOString().split('T')[0];
      sessionsByDate.set(dateKey, true);
    });

    const sortedDates = Array.from(sessionsByDate.keys()).sort().reverse();

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i - 1]);
      const prevDate = new Date(sortedDates[i]);
      const daysDiff = Math.floor(
        (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
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
}
