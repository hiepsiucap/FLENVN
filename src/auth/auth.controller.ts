import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { getUserRank } from '../users/user-rank';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body('refreshToken') refreshToken?: string,
    @Headers('x-refresh-token') refreshTokenHeader?: string,
  ) {
    return this.authService.refreshToken(refreshToken || refreshTokenHeader);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Request() req: AuthenticatedRequest,
    @Body('refreshToken') refreshToken?: string,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.authService.logout(req.user.id, refreshToken);
  }

  @Get('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: AuthenticatedRequest) {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    return { user: this.sanitizeUser(req.user) };
  }

  private sanitizeUser(user: User) {
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
