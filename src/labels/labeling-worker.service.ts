import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Message } from '@aws-sdk/client-sqs';
import { Repository } from 'typeorm';
import { FlashCard, LabelingStatus } from '../flashcards/flashcard.entity';
import { FlashcardLabel, LabelSource } from './flashcard-label.entity';
import { normalizeLabelName } from './label-taxonomy';
import { Label } from './label.entity';
import { LabelingJob, LabelingQueueService } from './labeling-queue.service';
import { VocabularyLabelClassifierService } from './vocabulary-label-classifier.service';

@Injectable()
export class LabelingWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(LabelingWorkerService.name);
  private running = false;

  constructor(
    @InjectRepository(FlashCard)
    private readonly flashcardRepository: Repository<FlashCard>,
    private readonly queueService: LabelingQueueService,
    private readonly classifier: VocabularyLabelClassifierService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.queueService.isEnabled()) {
      this.logger.log('Automatic labeling worker is disabled');
      return;
    }
    this.running = true;
    void this.poll();
    this.logger.log('Automatic labeling worker started with concurrency 1');
  }

  onApplicationShutdown(): void {
    this.running = false;
    this.queueService.destroy();
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const message = await this.queueService.receiveOne();
        if (message) await this.processMessage(message);
      } catch (error) {
        this.logger.error(
          `Labeling worker poll failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
        if (this.running) await this.delay(5000);
      }
    }
  }

  private async processMessage(message: Message): Promise<void> {
    const job = this.parseJob(message.Body);
    if (!job || !message.ReceiptHandle) {
      throw new Error(`Invalid labeling message ${message.MessageId ?? ''}`);
    }

    const flashcard = await this.flashcardRepository.findOne({
      where: { id: job.flashcardId, userId: job.userId },
    });
    if (!flashcard || flashcard.labelingVersion !== job.labelingVersion) {
      await this.queueService.acknowledge(message.ReceiptHandle);
      return;
    }

    flashcard.labelingStatus = LabelingStatus.PROCESSING;
    flashcard.labelingAttempts += 1;
    await this.flashcardRepository.save(flashcard);

    try {
      const labels = await this.classifier.classify(flashcard);
      if (labels === undefined) {
        throw new Error('Gemini returned no valid label classification');
      }

      const saved = await this.flashcardRepository.manager.transaction(
        async (manager) => {
          const current = await manager.getRepository(FlashCard).findOne({
            where: { id: job.flashcardId, userId: job.userId },
          });
          if (!current || current.labelingVersion !== job.labelingVersion) {
            return false;
          }

          await manager.delete(FlashcardLabel, {
            flashcardId: current.id,
            source: LabelSource.GEMINI,
          });

          for (const classifiedLabel of labels) {
            const normalizedName = normalizeLabelName(classifiedLabel.name);
            await manager
              .createQueryBuilder()
              .insert()
              .into(Label)
              .values({
                userId: current.userId,
                name: classifiedLabel.name,
                normalizedName,
                type: classifiedLabel.type,
                color: null,
              })
              .orIgnore()
              .execute();
            const label = await manager.getRepository(Label).findOneOrFail({
              where: { userId: current.userId, normalizedName },
            });
            await manager
              .createQueryBuilder()
              .insert()
              .into(FlashcardLabel)
              .values({
                flashcardId: current.id,
                labelId: label.id,
                source: LabelSource.GEMINI,
                confirmedByUser: false,
              })
              .orIgnore()
              .execute();
          }

          current.labelingStatus = LabelingStatus.COMPLETED;
          current.labeledAt = new Date();
          await manager.save(current);
          return true;
        },
      );

      if (!saved) {
        this.logger.log(
          `Discarded stale labeling result for flashcard ${job.flashcardId}`,
        );
      }
      await this.queueService.acknowledge(message.ReceiptHandle);
    } catch (error) {
      await this.flashcardRepository.update(
        { id: job.flashcardId, labelingVersion: job.labelingVersion },
        { labelingStatus: LabelingStatus.FAILED },
      );
      this.logger.warn(
        `Labeling job failed for flashcard ${job.flashcardId}, attempt ${
          message.Attributes?.ApproximateReceiveCount ?? 'unknown'
        }: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private parseJob(body: string | undefined): LabelingJob | undefined {
    if (!body) return undefined;
    try {
      const parsed = JSON.parse(body) as Partial<LabelingJob>;
      if (
        parsed.type !== 'classify-flashcard-labels' ||
        typeof parsed.flashcardId !== 'string' ||
        typeof parsed.userId !== 'string' ||
        typeof parsed.labelingVersion !== 'number'
      ) {
        return undefined;
      }
      return parsed as LabelingJob;
    } catch {
      return undefined;
    }
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
