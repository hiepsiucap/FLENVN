import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/user.entity';
import {
  AnswerListeningDto,
  GenerateListeningDto,
  SentenceAudioDto,
} from './listening.dto';
import { ListeningService } from './listening.service';

@ApiTags('Listening')
@ApiBearerAuth('jwt-auth')
@Controller('listening/sets')
@UseGuards(JwtAuthGuard)
export class ListeningController {
  constructor(private readonly listening: ListeningService) {}
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  generate(@CurrentUser() user: User, @Body() dto: GenerateListeningDto) {
    return this.listening.generate(user.id, dto);
  }
  @Post('sentence-audio')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  sentenceAudio(@CurrentUser() user: User, @Body() dto: SentenceAudioDto) {
    return this.listening.sentenceAudio(user.id, dto.flashcardId);
  }
  @Get(':id')
  get(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.listening.get(user.id, id);
  }
  @Post(':id/answers')
  answer(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AnswerListeningDto,
  ) {
    return this.listening.answer(user.id, id, dto);
  }
}
