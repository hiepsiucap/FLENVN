import {
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
import { FlashcardsService } from './flashcards.service';
import { CreateFlashcardDto } from './dto/create-flashcard.dto';
import { UpdateFlashcardDto } from './dto/update-flashcard.dto';
import { FlashCardStatus } from './flashcard.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

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
    return {
      success: true,
      data: await this.flashcardsService.createFlashcard(
        req.user.id,
        createFlashcardDto,
      ),
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getFlashcards(
    @Request() req: AuthenticatedRequest,
    @Query('bookId') bookId?: string,
    @Query('status') status?: FlashCardStatus,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.flashcardsService.getFlashcards(
        req.user.id,
        bookId,
        status,
      ),
    };
  }

  @Get('review/due')
  @UseGuards(JwtAuthGuard)
  async getCardsForReview(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit: number = 20,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.flashcardsService.getCardsForReview(req.user.id, limit),
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.flashcardsService.getStats(req.user.id),
    };
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
    return {
      success: true,
      data: await this.flashcardsService.getFlashcardById(
        flashcardId,
        req.user.id,
      ),
    };
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
    return {
      success: true,
      data: await this.flashcardsService.updateFlashcard(
        flashcardId,
        req.user.id,
        updateFlashcardDto,
      ),
    };
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
    return {
      success: true,
      data: await this.flashcardsService.deleteFlashcard(
        flashcardId,
        req.user.id,
      ),
    };
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
    return {
      success: true,
      data: await this.flashcardsService.reviewFlashcard(
        flashcardId,
        req.user.id,
        quality,
      ),
    };
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
    return {
      success: true,
      data: await this.flashcardsService.markAsMastered(
        flashcardId,
        req.user.id,
      ),
    };
  }
}
