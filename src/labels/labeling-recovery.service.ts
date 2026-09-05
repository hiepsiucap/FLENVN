import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashCard, LabelingStatus } from '../flashcards/flashcard.entity';
import { LabelingQueueService } from './labeling-queue.service';

@Injectable()
export class LabelingRecoveryService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(LabelingRecoveryService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(FlashCard)
    private readonly flashcardRepository: Repository<FlashCard>,
    private readonly configService: ConfigService,
    private readonly queueService: LabelingQueueService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.queueService.isEnabled()) return;
    const intervalMs = 5 * 60 * 1000;
    this.timer = setInterval(() => void this.republishPending(), intervalMs);
    this.timer.unref();
    void this.republishPending();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async republishPending(): Promise<void> {
    const recoveryMinutes = this.configService.get<number>(
      'services.autoLabeling.pendingRecoveryMinutes',
      5,
    );
    const cutoff = new Date(Date.now() - recoveryMinutes * 60 * 1000);
    const pending = await this.flashcardRepository
      .createQueryBuilder('flashcard')
      .where('flashcard.labelingStatus = :status', {
        status: LabelingStatus.PENDING,
      })
      .andWhere(
        '(flashcard.labelingQueuedAt IS NULL OR flashcard.labelingQueuedAt <= :cutoff)',
        { cutoff },
      )
      .orderBy('flashcard.createdAt', 'ASC')
      .limit(50)
      .getMany();

    let publishedCount = 0;
    for (const flashcard of pending) {
      const published = await this.queueService.publish({
        type: 'classify-flashcard-labels',
        flashcardId: flashcard.id,
        userId: flashcard.userId,
        labelingVersion: flashcard.labelingVersion,
      });
      if (published) {
        publishedCount += 1;
        await this.flashcardRepository.update(
          { id: flashcard.id, labelingVersion: flashcard.labelingVersion },
          { labelingQueuedAt: new Date() },
        );
      }
    }

    if (publishedCount > 0) {
      this.logger.log(`Republished ${publishedCount} pending labeling jobs`);
    }
  }
}
