import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';

export interface LabelingJob {
  type: 'classify-flashcard-labels';
  flashcardId: string;
  userId: string;
  labelingVersion: number;
}

@Injectable()
export class LabelingQueueService {
  private readonly logger = new Logger(LabelingQueueService.name);
  private readonly queueUrl: string;
  private readonly enabled: boolean;
  private readonly client?: SQSClient;

  constructor(private readonly configService: ConfigService) {
    this.queueUrl = this.configService.get<string>(
      'services.autoLabeling.queueUrl',
      '',
    );
    this.enabled =
      this.configService.get<boolean>('services.autoLabeling.enabled', false) &&
      Boolean(this.queueUrl);
    if (this.enabled) {
      this.client = new SQSClient({
        region: this.configService.get<string>(
          'services.aws.region',
          'us-east-1',
        ),
      });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async publish(job: LabelingJob): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(job),
        }),
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Could not publish labeling job for flashcard ${job.flashcardId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return false;
    }
  }

  async receiveOne() {
    if (!this.client) return undefined;
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 60,
        MessageSystemAttributeNames: ['ApproximateReceiveCount'],
      }),
    );
    return response.Messages?.[0];
  }

  async acknowledge(receiptHandle: string): Promise<void> {
    if (!this.client) return;
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }

  destroy(): void {
    this.client?.destroy();
  }
}
