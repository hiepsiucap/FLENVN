import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '../users/user.entity';
import { SuggestWordDto } from './dto/suggest-word.dto';
import { WordSuggestionResponse, WordsService } from './words.service';

@ApiTags('Words')
@ApiBearerAuth('jwt-auth')
@Controller('words')
@UseGuards(JwtAuthGuard)
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get('suggest')
  suggest(
    @CurrentUser() user: User,
    @Query() dto: SuggestWordDto,
  ): Promise<WordSuggestionResponse> {
    return this.wordsService.suggestWord(user.id, dto);
  }
}
