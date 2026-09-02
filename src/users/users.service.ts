import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { User } from './user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SanitizedUser } from '../auth/interfaces/auth.interfaces';
import { getUserRank } from './user-rank';
import { UserDailyProgress } from './user-daily-progress.entity';
import { UpdateStreakSettingsDto } from './dto/update-streak-settings.dto';
import type { StreakProgress, StreakStatus } from './streak.types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDailyProgress)
    private readonly dailyProgressRepository: Repository<UserDailyProgress>,
    private readonly dataSource: DataSource,
  ) {}

  async getProfile(userId: string): Promise<SanitizedUser> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<SanitizedUser> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is already taken by another user
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateProfileDto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email is already in use');
      }
    }

    // Update fields
    if (updateProfileDto.username) {
      user.username = updateProfileDto.username;
    }
    if (updateProfileDto.email) {
      user.email = updateProfileDto.email;
      user.isEmailVerified = false; // Reset verification if email changed
    }

    const updatedUser = await this.userRepository.save(user);
    return this.sanitizeUser(updatedUser);
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { oldPassword, newPassword, confirmPassword } = changePasswordDto;

    // Validate new passwords match
    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    // Validate new password is different from old
    if (oldPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from old password',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash and save new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedPassword;

    await this.userRepository.save(user);
    return { message: 'Password changed successfully' };
  }

  async getAllUsers(): Promise<SanitizedUser[]> {
    const users = await this.userRepository.find();
    return users.map((user) => this.sanitizeUser(user));
  }

  async getUserById(id: string): Promise<SanitizedUser> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.remove(user);
    return { message: 'User deleted successfully' };
  }

  async verifyEmailById(id: string): Promise<SanitizedUser> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isEmailVerified = true;
    user.isActive = true;
    const updatedUser = await this.userRepository.save(user);
    return this.sanitizeUser(updatedUser);
  }

  async recordProgress(userId: string, score: number): Promise<StreakProgress> {
    return this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const progressRepository = manager.getRepository(UserDailyProgress);
      const user = await userRepository.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const now = new Date();
      const today = this.toLocalDateKey(now, user.timezone);
      this.applyPendingTarget(user, today);
      const scoreAdded = Math.max(0, Math.floor(score));
      const previousStreak = this.getActiveStreak(user, today);
      let progress = await progressRepository.findOne({
        where: { userId, localDate: today },
        lock: { mode: 'pessimistic_write' },
      });

      if (!progress) {
        progress = progressRepository.create({
          userId,
          localDate: today,
          earnedScore: 0,
          targetScore: user.dailyScoreTarget,
          completedAt: null,
        });
      }

      progress.earnedScore += scoreAdded;
      const justCompleted =
        progress.completedAt === null &&
        progress.earnedScore >= progress.targetScore;

      if (justCompleted) {
        const daysSinceLastStreak = user.lastStreakDate
          ? this.daysBetween(user.lastStreakDate, today)
          : null;
        user.streak =
          daysSinceLastStreak === 0
            ? Math.max(1, user.streak)
            : daysSinceLastStreak === 1
              ? user.streak + 1
              : 1;
        user.longestStreak = Math.max(user.longestStreak, user.streak);
        user.lastStreakDate = today;
        progress.completedAt = now;
      }

      user.exp += scoreAdded;
      user.level = this.calculateLevel(user.exp);
      user.lastActive = now;

      await progressRepository.save(progress);
      await userRepository.save(user);

      return this.buildStreakProgress(
        scoreAdded,
        progress,
        previousStreak,
        justCompleted ? user.streak : previousStreak,
        justCompleted,
      );
    });
  }

  private calculateLevel(exp: number): number {
    return Math.floor(exp / 1000) + 1;
  }

  async getStreakStatus(userId: string): Promise<StreakStatus> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const today = this.toLocalDateKey(new Date(), user.timezone);
    await this.persistPendingTargetIfDue(user, today);
    const progress = await this.dailyProgressRepository.findOne({
      where: { userId, localDate: today },
    });
    const todayScore = progress?.earnedScore ?? 0;
    const dailyTarget = progress?.targetScore ?? user.dailyScoreTarget;
    const completedToday = progress?.completedAt != null;
    const currentStreak = this.getActiveStreak(user, today);
    const remainingScore = Math.max(0, dailyTarget - todayScore);

    return {
      currentStreak,
      longestStreak: user.longestStreak,
      dailyTarget,
      nextDailyTarget: user.pendingDailyScoreTarget,
      targetEffectiveDate: user.targetEffectiveDate,
      todayScore,
      remainingScore,
      progressPercent: this.progressPercent(todayScore, dailyTarget),
      completedToday,
      lastCompletedDate: user.lastStreakDate,
      timezone: user.timezone,
      message: completedToday
        ? `Daily goal complete. Your ${currentStreak}-day streak is protected.`
        : `Earn ${remainingScore} more point${remainingScore === 1 ? '' : 's'} today to protect your ${currentStreak}-day streak.`,
    };
  }

  async updateStreakSettings(
    userId: string,
    dto: UpdateStreakSettingsDto,
  ): Promise<{
    dailyTarget: number;
    nextDailyTarget: number | null;
    effectiveDate: string | null;
    timezone: string;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.timezone !== undefined) {
      this.assertValidTimezone(dto.timezone);
      user.timezone = dto.timezone;
    }

    const today = this.toLocalDateKey(new Date(), user.timezone);
    await this.persistPendingTargetIfDue(user, today);

    if (dto.dailyTarget !== undefined) {
      user.pendingDailyScoreTarget = dto.dailyTarget;
      user.targetEffectiveDate = this.addDays(today, 1);
    }

    await this.userRepository.save(user);
    return {
      dailyTarget: user.dailyScoreTarget,
      nextDailyTarget: user.pendingDailyScoreTarget,
      effectiveDate: user.targetEffectiveDate,
      timezone: user.timezone,
    };
  }

  private buildStreakProgress(
    scoreAdded: number,
    progress: UserDailyProgress,
    previousStreak: number,
    currentStreak: number,
    justCompleted: boolean,
  ): StreakProgress {
    return {
      scoreAdded,
      todayScore: progress.earnedScore,
      dailyTarget: progress.targetScore,
      remainingScore: Math.max(0, progress.targetScore - progress.earnedScore),
      progressPercent: this.progressPercent(
        progress.earnedScore,
        progress.targetScore,
      ),
      completedToday: progress.completedAt !== null,
      justCompleted,
      previousStreak,
      currentStreak,
    };
  }

  private progressPercent(score: number, target: number): number {
    return Math.max(0, Math.min(100, Math.floor((score / target) * 100)));
  }

  private getActiveStreak(user: User, today: string): number {
    if (!user.lastStreakDate) return 0;
    return this.daysBetween(user.lastStreakDate, today) <= 1 ? user.streak : 0;
  }

  private applyPendingTarget(user: User, today: string): boolean {
    if (
      user.pendingDailyScoreTarget === null ||
      user.targetEffectiveDate === null ||
      user.targetEffectiveDate > today
    ) {
      return false;
    }
    user.dailyScoreTarget = user.pendingDailyScoreTarget;
    user.pendingDailyScoreTarget = null;
    user.targetEffectiveDate = null;
    return true;
  }

  private async persistPendingTargetIfDue(
    user: User,
    today: string,
  ): Promise<void> {
    if (this.applyPendingTarget(user, today)) {
      await this.userRepository.save(user);
    }
  }

  private toLocalDateKey(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  }

  private assertValidTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException('Invalid IANA timezone');
    }
  }

  private daysBetween(from: string, to: string): number {
    return Math.floor(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    );
  }

  private addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  private sanitizeUser(user: User): SanitizedUser {
    const {
      password,
      emailVerificationToken,
      passwordResetToken,
      passwordResetExpires,
      ...sanitizedUser
    } = user;
    return {
      ...sanitizedUser,
      rank: getUserRank(user.level, user.exp),
    };
  }
}
