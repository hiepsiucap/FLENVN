import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CreateFlashcardDto } from './dto/create-flashcard.dto';
import { UpdateFlashcardDto } from './dto/update-flashcard.dto';
import { FlashCardStatus } from './flashcard.entity';
import { FlashcardsService } from './flashcards.service';

@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createFlashcard(
    @Request() req: AuthenticatedRequest,
    @Body() createFlashcardDto: CreateFlashcardDto,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.createFlashcard(
      req.user.id,
      createFlashcardDto,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getFlashcards(
    @Request() req: AuthenticatedRequest,
    @Query('bookId') bookId?: string,
    @Query('status') status?: string,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }

    let statusFilter: FlashCardStatus | undefined;
    if (status && status !== 'all') {
      const allowedStatuses = Object.values(FlashCardStatus);
      if (!allowedStatuses.includes(status as FlashCardStatus)) {
        throw new BadRequestException(
          `Invalid status. Allowed values: all, ${allowedStatuses.join(', ')}`,
        );
      }
      statusFilter = status as FlashCardStatus;
    }

    return this.flashcardsService.getFlashcards(
      req.user.id,
      bookId,
      statusFilter,
    );
  }

  @Get('review/due')
  @UseGuards(JwtAuthGuard)
  async getCardsForReview(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit: number = 20,
    @Query('bookId') bookId?: string,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.getCardsForReview(req.user.id, limit, bookId);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.getStats(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getFlashcardById(
    @Request() req: AuthenticatedRequest,
    @Param('id') flashcardId: string,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.getFlashcardById(flashcardId, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateFlashcard(
    @Request() req: AuthenticatedRequest,
    @Param('id') flashcardId: string,
    @Body() updateFlashcardDto: UpdateFlashcardDto,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.updateFlashcard(
      flashcardId,
      req.user.id,
      updateFlashcardDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteFlashcard(
    @Request() req: AuthenticatedRequest,
    @Param('id') flashcardId: string,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.deleteFlashcard(flashcardId, req.user.id);
  }

  @Post(':id/review')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async reviewFlashcard(
    @Request() req: AuthenticatedRequest,
    @Param('id') flashcardId: string,
    @Body('quality') quality: number,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.reviewFlashcard(
      flashcardId,
      req.user.id,
      quality,
    );
  }

  @Post(':id/mastered')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markAsMastered(
    @Request() req: AuthenticatedRequest,
    @Param('id') flashcardId: string,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.markAsMastered(flashcardId, req.user.id);
  }
}
