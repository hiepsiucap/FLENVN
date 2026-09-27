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
  ServiceUnavailableException,
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
import { FlashcardAudioService } from './flashcard-audio.service';
import { FlashcardImageService } from './flashcard-image.service';
import { SuggestFlashcardAudioDto } from './dto/suggest-flashcard-audio.dto';
import { AssignFlashcardLabelsDto } from '../labels/dto/assign-flashcard-labels.dto';
import { LabelsService } from '../labels/labels.service';

@Controller('flashcards')
export class FlashcardsController {
  constructor(
    private readonly flashcardsService: FlashcardsService,
    private readonly labelsService: LabelsService,
    private readonly flashcardAudioService: FlashcardAudioService,
    private readonly flashcardImageService: FlashcardImageService,
  ) {}

  @Post('audio/suggest')
  @UseGuards(JwtAuthGuard)
  async suggestAudio(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SuggestFlashcardAudioDto,
  ) {
    if (!req.user?.id) throw new BadRequestException('User not authenticated');
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Enter text to generate audio');
    const url = await this.flashcardAudioService.createAudioUrl(
      req.user.id,
      text,
    );
    if (!url)
      throw new ServiceUnavailableException('Audio suggestion is unavailable');
    return { url };
  }

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
    @Query('labelIds') labelIds?: string,
    @Query('labelMode') labelMode?: string,
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
      this.parseLabelIds(labelIds),
      labelMode,
    );
  }

  @Get('review/due')
  @UseGuards(JwtAuthGuard)
  async getCardsForReview(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit: number = 20,
    @Query('bookId') bookId?: string,
    @Query('labelIds') labelIds?: string,
    @Query('labelMode') labelMode?: string,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.getCardsForReview(
      req.user.id,
      limit,
      bookId,
      this.parseLabelIds(labelIds),
      labelMode,
    );
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.flashcardsService.getStats(req.user.id);
  }

  @Get('images/suggest')
  @UseGuards(JwtAuthGuard)
  async suggestImages(
    @Request() req: AuthenticatedRequest,
    @Query('word') word: string,
    @Query('limit') limit?: string,
  ) {
    if (!req.user?.id) throw new BadRequestException('User not authenticated');
    const query = word?.trim();
    if (!query || query.length > 100) {
      throw new BadRequestException('Enter a word of 100 characters or fewer');
    }
    const imageLimit = limit === undefined ? 6 : Number(limit);
    if (!Number.isInteger(imageLimit) || imageLimit < 1 || imageLimit > 10) {
      throw new BadRequestException('Image limit must be between 1 and 10');
    }
    return {
      images: await this.flashcardImageService.findImageUrls(query, imageLimit),
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

  @Put(':id/labels')
  @UseGuards(JwtAuthGuard)
  async replaceLabels(
    @Request() req: AuthenticatedRequest,
    @Param('id') flashcardId: string,
    @Body() dto: AssignFlashcardLabelsDto,
  ) {
    if (!req.user?.id) throw new Error('User not authenticated');
    return this.labelsService.replaceFlashcardLabels(
      req.user.id,
      flashcardId,
      dto,
    );
  }

  @Post(':id/labels/retry')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async retryLabeling(
    @Request() req: AuthenticatedRequest,
    @Param('id') flashcardId: string,
  ) {
    if (!req.user?.id) throw new Error('User not authenticated');
    return this.flashcardsService.retryLabeling(flashcardId, req.user.id);
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

  private parseLabelIds(value?: string): string[] {
    if (!value) return [];
    return Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }
}
