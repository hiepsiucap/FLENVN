import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SanitizedUser } from '../auth/interfaces/auth.interfaces';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  async recordProgress(userId: string, score: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const earnedExp = Math.max(0, Math.floor(score));
    const previousLastActive = user.lastActive;
    const now = new Date();

    user.exp += earnedExp;
    user.level = this.calculateLevel(user.exp);
    user.streak = this.calculateStreak(previousLastActive, now, user.streak);
    user.lastActive = now;

    await this.userRepository.save(user);
  }

  private calculateLevel(exp: number): number {
    return Math.floor(exp / 1000) + 1;
  }

  private calculateStreak(
    previousLastActive: Date | null,
    currentDate: Date,
    currentStreak: number,
  ): number {
    if (!previousLastActive) {
      return 1;
    }

    const previousDay = this.startOfDay(previousLastActive);
    const today = this.startOfDay(currentDate);
    const daysSinceLastActive = Math.floor(
      (today.getTime() - previousDay.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceLastActive === 0) {
      return Math.max(currentStreak, 1);
    }

    if (daysSinceLastActive === 1) {
      return currentStreak + 1;
    }

    return 1;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private sanitizeUser(user: User): SanitizedUser {
    const {
      password,
      emailVerificationToken,
      passwordResetToken,
      passwordResetExpires,
      ...sanitizedUser
    } = user;
    return sanitizedUser;
  }
}
