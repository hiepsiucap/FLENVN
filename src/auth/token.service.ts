import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createRefreshToken(userId: string): Promise<Token> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    const rawToken = this.generateToken();

    const refreshToken = this.tokenRepository.create({
      token: this.hashToken(rawToken),
      type: TokenType.REFRESH,
      userId,
      expiresAt,
    });

    const savedToken = await this.tokenRepository.save(refreshToken);
    savedToken.token = rawToken;
    return savedToken;
  }

  async createEmailVerificationToken(userId: string): Promise<Token> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
    const rawToken = this.generateToken();

    const emailToken = this.tokenRepository.create({
      token: this.hashToken(rawToken),
      type: TokenType.EMAIL_VERIFICATION,
      userId,
      expiresAt,
    });

    const savedToken = await this.tokenRepository.save(emailToken);
    savedToken.token = rawToken;
    return savedToken;
  }

  async createPasswordResetToken(userId: string): Promise<Token> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour
    const rawToken = this.generateToken();

    const resetToken = this.tokenRepository.create({
      token: this.hashToken(rawToken),
      type: TokenType.PASSWORD_RESET,
      userId,
      expiresAt,
    });

    const savedToken = await this.tokenRepository.save(resetToken);
    savedToken.token = rawToken;
    return savedToken;
  }

  async findValidToken(token: string, type: TokenType): Promise<Token | null> {
    return this.tokenRepository.findOne({
      where: {
        token: this.hashToken(token),
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
