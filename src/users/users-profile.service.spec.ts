import { ConflictException } from '@nestjs/common';
import { validate } from 'class-validator';
import type { Repository } from 'typeorm';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserDailyProgress } from './user-daily-progress.entity';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService profile settings', () => {
  function createHarness(overrides: Partial<User> = {}) {
    const user = {
      id: 'user-1',
      email: 'learner@example.com',
      password: 'hashed-password',
      username: 'learner',
      avatar: User.DEFAULT_AVATAR_URL,
      isEmailVerified: true,
      emailVerificationToken: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      level: 1,
      exp: 0,
      streak: 0,
      longestStreak: 0,
      dailyScoreTarget: 100,
      pendingDailyScoreTarget: null,
      targetEffectiveDate: null,
      timezone: 'Asia/Bangkok',
      lastStreakDate: null,
      lastActive: null,
      isActive: true,
      isAdmin: false,
      booksCount: 0,
      totalWordsUsed: 0,
      ...overrides,
    } as User;
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn((value: User) => Promise.resolve(value)),
    };
    const service = new UsersService(
      userRepository as unknown as Repository<User>,
      {} as Repository<UserDailyProgress>,
      {} as never,
    );

    return { service, user, userRepository };
  }

  it('updates the avatar returned by the upload flow', async () => {
    const { service, user } = createHarness();
    const avatar = 'https://cdn.example.com/avatars/user-1/avatar.jpg';

    const result = await service.updateProfile(user.id, { avatar });

    expect(user.avatar).toBe(avatar);
    expect(result.avatar).toBe(avatar);
    expect(result).not.toHaveProperty('password');
  });

  it('marks a changed email as unverified', async () => {
    const { service, user, userRepository } = createHarness();
    userRepository.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);

    await service.updateProfile(user.id, { email: 'new@example.com' });

    expect(user.email).toBe('new@example.com');
    expect(user.isEmailVerified).toBe(false);
  });

  it('preserves verification when the submitted email is unchanged', async () => {
    const { service, user } = createHarness();

    await service.updateProfile(user.id, { email: user.email });

    expect(user.isEmailVerified).toBe(true);
  });

  it('rejects an email already used by another account', async () => {
    const { service, user, userRepository } = createHarness();
    userRepository.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: 'user-2' } as User);

    await expect(
      service.updateProfile(user.id, { email: 'taken@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('UpdateProfileDto', () => {
  it('accepts an HTTPS avatar URL', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      avatar: 'https://cdn.example.com/avatar.jpg',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a non-HTTPS avatar URL', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      avatar: 'http://cdn.example.com/avatar.jpg',
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
