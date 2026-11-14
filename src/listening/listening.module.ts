import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashCard } from '../flashcards/flashcard.entity';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { ListeningSet } from './listening-set.entity';
import { ListeningController } from './listening.controller';
import { ListeningService } from './listening.service';
import { ListeningModelService } from './listening-model.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlashCard, ListeningSet]),
    FlashcardsModule,
  ],
  controllers: [ListeningController],
  providers: [ListeningService, ListeningModelService],
})
export class ListeningModule {}
