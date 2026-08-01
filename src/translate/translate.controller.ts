import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TranslateTextDto } from './dto/translate-text.dto';
import { TranslateService } from './translate.service';

@ApiTags('Translation')
@Controller('translation')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  @Post('translate')
  async translate(@Body() dto: TranslateTextDto) {
    return this.translateService.translateText(dto);
  }
}
