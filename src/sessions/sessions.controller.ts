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

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('flashcard/:flashcardId')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Param('flashcardId') flashcardId: string,
    @Body() createSessionDto: CreateSessionDto,
    @CurrentUser() user: any,
  ) {
    const session = await this.sessionsService.createSession(
      user.id,
      flashcardId,
      createSessionDto,
    );

    return {
      message: 'Session recorded successfully',
      data: session,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async getSessionHistory(
    @CurrentUser() user: any,
    @Query('flashcardId') flashcardId?: string,
    @Query('days') days?: string,
  ) {
    const sessions = await this.sessionsService.getSessionHistory(
      user.id,
      flashcardId,
      days ? parseInt(days) : undefined,
    );

    return {
      data: sessions,
      count: sessions.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  async getStudyStats(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ) {
    const stats = await this.sessionsService.getStudyStats(
      user.id,
      days ? parseInt(days) : 7,
    );

    return {
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('streak')
  async getStreakStats(@CurrentUser() user: any) {
    const stats = await this.sessionsService.getStreakStats(user.id);

    return {
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':sessionId')
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
  ) {
    return this.sessionsService.deleteSession(sessionId, user.id);
  }
}
