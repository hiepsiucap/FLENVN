import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '../users/user.entity';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('flashcard/:flashcardId')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Param('flashcardId') flashcardId: string,
    @Body() createSessionDto: CreateSessionDto,
    @CurrentUser() user: User,
  ) {
    const session = await this.sessionsService.createSession(
      user.id,
      flashcardId,
      createSessionDto,
    );

    return {
      message: 'Session recorded successfully',
      session,
    };
  }

  @Get()
  async getSessionHistory(
    @CurrentUser() user: User,
    @Query('flashcardId') flashcardId?: string,
    @Query('days') days?: string,
  ) {
    const sessions = await this.sessionsService.getSessionHistory(
      user.id,
      flashcardId,
      days ? parseInt(days) : undefined,
    );

    return {
      sessions,
      count: sessions.length,
    };
  }

  @Get('stats')
  async getStudyStats(@CurrentUser() user: User, @Query('days') days?: string) {
    const stats = await this.sessionsService.getStudyStats(
      user.id,
      days ? parseInt(days) : 7,
    );

    return stats;
  }

  @Get('streak')
  async getStreakStats(@CurrentUser() user: User) {
    const stats = await this.sessionsService.getStreakStats(user.id);

    return stats;
  }

  @Delete(':sessionId')
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.deleteSession(sessionId, user.id);
  }
}
