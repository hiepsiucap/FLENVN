import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashCard } from './flashcard.entity';
import { FlashcardsService } from './flashcards.service';
import { FlashcardsController } from './flashcards.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BooksModule } from '../books/books.module';
import { FlashcardImageService } from './flashcard-image.service';
import { FlashcardAudioService } from './flashcard-audio.service';
import { LabelsModule } from '../labels/labels.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlashCard]),
    SubscriptionsModule,
    BooksModule,
    LabelsModule,
  ],
  controllers: [FlashcardsController],
  providers: [FlashcardsService, FlashcardImageService, FlashcardAudioService],
  exports: [FlashcardsService, FlashcardImageService, FlashcardAudioService],
})
export class FlashcardsModule {}
