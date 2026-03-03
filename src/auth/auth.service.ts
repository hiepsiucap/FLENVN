import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AuthTokens,
  JwtPayload,
  LoginResponse,
  RegisterResponse,
  SanitizedUser,
} from './interfaces/auth.interfaces';
import { Token, TokenType } from './token.entity';
import { TokenService } from './token.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    const { email, password, username } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      username,
    });

    const savedUser = await this.userRepository.save(user);

    // Assign free plan on registration
    await this.subscriptionsService.assignFreePlan(savedUser.id);

    // Create email verification token
    const emailToken = await this.tokenService.createEmailVerificationToken(
      savedUser.id,
    );

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      savedUser.id,
    );

    return {
      user: this.sanitizeUser(savedUser),
      accessToken,
      refreshToken: refreshToken.token,
      emailVerificationToken: emailToken.token,
    };
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Update last active
    await this.userRepository.update(user.id, {
      lastActive: new Date(),
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  async refreshToken(refreshTokenString: string): Promise<AuthTokens> {
    const tokenRecord = await this.tokenService.findValidToken(
      refreshTokenString,
      TokenType.REFRESH,
    );

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke old refresh token
    await this.tokenService.revokeToken(tokenRecord.id);

    // Generate new tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      tokenRecord.userId,
    );

    return {
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  async logout(userId: string, refreshTokenString?: string) {
    if (refreshTokenString) {
      // Revoke specific refresh token
      const tokenRecord = await this.tokenService.findValidToken(
        refreshTokenString,
        TokenType.REFRESH,
      );
      if (tokenRecord) {
        await this.tokenService.revokeToken(tokenRecord.id);
      }
    } else {
      // Revoke all refresh tokens for user
      await this.tokenService.revokeAllUserTokens(userId, TokenType.REFRESH);
    }

    return { message: 'Successfully logged out' };
  }

  async verifyEmail(token: string) {
    const tokenRecord = await this.tokenService.findValidToken(
      token,
      TokenType.EMAIL_VERIFICATION,
    );

    if (!tokenRecord) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Update user's email verification status
    await this.userRepository.update(tokenRecord.userId, {
      isEmailVerified: true,
    });

    // Revoke token
    await this.tokenService.revokeToken(tokenRecord.id);

    return { message: 'Email verified successfully' };
  }

  private async generateTokens(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: Token }> {
    const payload: JwtPayload = { sub: userId };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.tokenService.createRefreshToken(userId);

    return { accessToken, refreshToken };
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

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });
  }
}
