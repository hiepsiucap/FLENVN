import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TranslateTextDto } from './dto/translate-text.dto';
import { TranslateService } from './translate.service';

@ApiTags('Translation')
@ApiBearerAuth('jwt-auth')
@Controller('translation')
@UseGuards(JwtAuthGuard)
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  @Post('translate')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async translate(@Body() dto: TranslateTextDto) {
    return this.translateService.translateText(dto);
  }
}
