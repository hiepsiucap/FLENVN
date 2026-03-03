import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { Token, TokenType } from './token.entity';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
  ) {}
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async createRefreshToken(userId: string): Promise<Token> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const refreshToken = this.tokenRepository.create({
      token: this.generateToken(),
      type: TokenType.REFRESH,
      userId,
      expiresAt,
    });

    return this.tokenRepository.save(refreshToken);
  }

  async createEmailVerificationToken(userId: string): Promise<Token> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    const emailToken = this.tokenRepository.create({
      token: this.generateToken(),
      type: TokenType.EMAIL_VERIFICATION,
      userId,
      expiresAt,
    });

    return this.tokenRepository.save(emailToken);
  }

  async createPasswordResetToken(userId: string): Promise<Token> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

    const resetToken = this.tokenRepository.create({
      token: this.generateToken(),
      type: TokenType.PASSWORD_RESET,
      userId,
      expiresAt,
    });

    return this.tokenRepository.save(resetToken);
  }

  async findValidToken(token: string, type: TokenType): Promise<Token | null> {
    return this.tokenRepository.findOne({
      where: {
        token,
        type,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.tokenRepository.update(tokenId, { isRevoked: true });
  }

  async revokeAllUserTokens(userId: string, type?: TokenType): Promise<void> {
    const query: { userId: string; isRevoked: boolean; type?: TokenType } = {
      userId,
      isRevoked: false,
    };

    if (type) {
      query.type = type;
    }

    await this.tokenRepository.update(query, { isRevoked: true });
  }
}
