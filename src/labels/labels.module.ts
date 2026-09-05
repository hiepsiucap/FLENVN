import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashCard } from '../flashcards/flashcard.entity';
import { FlashcardLabel } from './flashcard-label.entity';
import { Label } from './label.entity';
import { LabelingQueueService } from './labeling-queue.service';
import { LabelingRecoveryService } from './labeling-recovery.service';
import { LabelingWorkerService } from './labeling-worker.service';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { VocabularyLabelClassifierService } from './vocabulary-label-classifier.service';

@Module({
  imports: [TypeOrmModule.forFeature([Label, FlashcardLabel, FlashCard])],
  controllers: [LabelsController],
  providers: [
    LabelsService,
    LabelingQueueService,
    VocabularyLabelClassifierService,
    LabelingWorkerService,
    LabelingRecoveryService,
  ],
  exports: [LabelsService, LabelingQueueService],
})
export class LabelsModule {}
