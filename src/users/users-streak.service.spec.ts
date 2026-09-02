import type { Repository } from 'typeorm';
import { UserDailyProgress } from './user-daily-progress.entity';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { validate } from 'class-validator';
import { UpdateStreakSettingsDto } from './dto/update-streak-settings.dto';

describe('UsersService streak goals', () => {
  function createHarness(initialScore = 0) {
    const user = {
      id: 'user-1',
      exp: 0,
      level: 1,
      streak: 0,
      longestStreak: 0,
      dailyScoreTarget: 100,
      pendingDailyScoreTarget: null,
      targetEffectiveDate: null,
      timezone: 'Asia/Bangkok',
      lastStreakDate: null,
      lastActive: null,
    } as User;
    let progress: UserDailyProgress | null =
      initialScore > 0
        ? ({
            userId: user.id,
            localDate: 'unused',
            earnedScore: initialScore,
            targetScore: 100,
            completedAt: null,
          } as UserDailyProgress)
        : null;

    const userRepository = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn((value: User) => Promise.resolve(value)),
    };
    const progressRepository = {
      findOne: jest.fn(() => Promise.resolve(progress)),
      create: jest.fn((value: Partial<UserDailyProgress>) =>
        Object.assign(new UserDailyProgress(), value),
      ),
      save: jest.fn((value: UserDailyProgress) => {
        progress = value;
        return Promise.resolve(value);
      }),
    };
    const manager = {
      getRepository: jest.fn(
        (entity: typeof User | typeof UserDailyProgress) =>
          entity === User ? userRepository : progressRepository,
      ),
    };
    const dataSource = {
      transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
        Promise.resolve(callback(manager)),
      ),
    };
    const service = new UsersService(
      userRepository as unknown as Repository<User>,
      progressRepository as unknown as Repository<UserDailyProgress>,
      dataSource as never,
    );

    return { service, user, getProgress: () => progress };
  }

  it('does not earn a streak before reaching the daily target', async () => {
    const { service, user } = createHarness();

    const result = await service.recordProgress(user.id, 70);

    expect(result).toEqual(
      expect.objectContaining({
        todayScore: 70,
        remainingScore: 30,
        progressPercent: 70,
        completedToday: false,
        justCompleted: false,
        currentStreak: 0,
      }),
    );
    expect(user.streak).toBe(0);
  });

  it('earns the streak exactly once when cumulative score crosses the target', async () => {
    const { service, user } = createHarness();

    await service.recordProgress(user.id, 70);
    const crossing = await service.recordProgress(user.id, 40);
    const later = await service.recordProgress(user.id, 25);

    expect(crossing).toEqual(
      expect.objectContaining({
        todayScore: 110,
        completedToday: true,
        justCompleted: true,
        previousStreak: 0,
        currentStreak: 1,
      }),
    );
    expect(later.justCompleted).toBe(false);
    expect(later.currentStreak).toBe(1);
    expect(user.streak).toBe(1);
  });

  it('schedules a target change for the following local day', async () => {
    const { service, user } = createHarness();

    const result = await service.updateStreakSettings(user.id, {
      dailyTarget: 150,
    });

    expect(result.dailyTarget).toBe(100);
    expect(result.nextDailyTarget).toBe(150);
    expect(result.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not increment a migrated streak twice on the same day', async () => {
    const { service, user } = createHarness();
    user.streak = 5;
    user.longestStreak = 5;
    user.lastStreakDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: user.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const result = await service.recordProgress(user.id, 100);

    expect(result.justCompleted).toBe(true);
    expect(result.currentStreak).toBe(5);
    expect(user.streak).toBe(5);
  });

  it('accepts a daily target up to 20,000', async () => {
    const dto = new UpdateStreakSettingsDto();
    dto.dailyTarget = 20_000;

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a daily target above 20,000', async () => {
    const dto = new UpdateStreakSettingsDto();
    dto.dailyTarget = 20_001;

    const errors = await validate(dto);
    expect(errors[0].constraints?.max).toContain('20000');
  });
});
