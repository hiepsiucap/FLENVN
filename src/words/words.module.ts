import { Module } from '@nestjs/common';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { TranslateModule } from '../translate/translate.module';
import { WordsController } from './words.controller';
import { WordsExampleService } from './words-example.service';
import { WordsService } from './words.service';

@Module({
  imports: [FlashcardsModule, TranslateModule],
  controllers: [WordsController],
  providers: [WordsService, WordsExampleService],
})
export class WordsModule {}
