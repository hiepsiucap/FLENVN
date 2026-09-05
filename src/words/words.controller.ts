import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '../users/user.entity';
import { AutocompleteWordDto } from './dto/autocomplete-word.dto';
import { CorrectTextDto } from './dto/correct-text.dto';
import { ExplainWordInContextDto } from './dto/explain-word-in-context.dto';
import { SuggestWordDto } from './dto/suggest-word.dto';
import { SuggestTopicVocabularyDto } from './dto/suggest-topic-vocabulary.dto';
import {
  TextCorrectionResponse,
  TopicVocabularySuggestionResponse,
  WordAutocompleteResponse,
  WordSuggestionResponse,
  WordsService,
} from './words.service';

@ApiTags('Words')
@ApiBearerAuth('jwt-auth')
@Controller('words')
@UseGuards(JwtAuthGuard)
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get('autocomplete')
  autocomplete(
    @Query() dto: AutocompleteWordDto,
  ): Promise<WordAutocompleteResponse> {
    return this.wordsService.autocompleteWords(dto);
  }

  @Post('correct')
  correct(@Body() dto: CorrectTextDto): Promise<TextCorrectionResponse> {
    return this.wordsService.correctText(dto);
  }

  @Post('suggest-topic')
  suggestTopicVocabulary(
    @Body() dto: SuggestTopicVocabularyDto,
  ): Promise<TopicVocabularySuggestionResponse> {
    return this.wordsService.suggestTopicVocabulary(dto);
  }

  @Get('suggest')
  suggest(
    @CurrentUser() user: User,
    @Query() dto: SuggestWordDto,
  ): Promise<WordSuggestionResponse> {
    return this.wordsService.suggestWord(user.id, dto);
  }

  @Post('explain-in-context')
  @HttpCode(HttpStatus.OK)
  explainInContext(
    @CurrentUser() user: User,
    @Body() dto: ExplainWordInContextDto,
  ) {
    return this.wordsService.explainWordInContext(user.id, dto);
  }
}
