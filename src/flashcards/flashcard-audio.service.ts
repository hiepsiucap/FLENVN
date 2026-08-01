import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  Engine,
  OutputFormat,
  PollyClient,
  SynthesizeSpeechCommand,
  VoiceId,
} from '@aws-sdk/client-polly';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

@Injectable()
export class FlashcardAudioService {
  private readonly logger = new Logger(FlashcardAudioService.name);
  private readonly pollyClient: PollyClient;
  private readonly s3Client: S3Client;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>(
      'services.aws.accessKeyId',
    );
    const secretAccessKey = this.configService.get<string>(
      'services.aws.secretAccessKey',
    );
    const credentials =
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined;

    this.pollyClient = new PollyClient({
      region: this.configService.get<string>(
        'services.aws.polly.region',
        this.configService.get<string>('services.aws.region', 'us-east-1'),
      ),
      credentials,
    });

    this.s3Client = new S3Client({
      region: this.configService.get<string>(
        'services.aws.s3.region',
        this.configService.get<string>('services.aws.region', 'us-east-1'),
      ),
      credentials,
    });
  }

  async createAudioUrl(
    userId: string,
    word: string,
  ): Promise<string | undefined> {
    const text = word.trim();
    if (!text) return undefined;

    const bucket = this.configService.get<string>('services.aws.s3.bucket');
    const s3Region = this.configService.get<string>(
      'services.aws.s3.region',
      this.configService.get<string>('services.aws.region', 'us-east-1'),
    );

    if (!bucket) {
      this.logger.warn('Skipping Polly audio: AWS_S3_BUCKET is not configured');
      return undefined;
    }

    try {
      const audio = await this.synthesize(text);
      const objectKey = `audio/flashcards/${userId}/${Date.now()}-${randomUUID()}.mp3`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: audio,
          ContentType: 'audio/mpeg',
        }),
      );

      return `https://${bucket}.s3.${s3Region}.amazonaws.com/${objectKey}`;
    } catch (error) {
      this.logger.warn(
        `Polly audio generation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return undefined;
    }
  }

  private async synthesize(text: string): Promise<Buffer> {
    const voiceId = this.configService.get<string>(
      'services.aws.polly.voiceId',
      'Joanna',
    ) as VoiceId;
    const engine = this.configService.get<string>(
      'services.aws.polly.engine',
      'standard',
    ) as Engine;

    const response = await this.pollyClient.send(
      new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: OutputFormat.MP3,
        VoiceId: voiceId,
        Engine: engine,
      }),
    );

    if (!response.AudioStream) {
      throw new Error('Polly returned no audio stream');
    }

    return this.streamToBuffer(response.AudioStream);
  }

  private async streamToBuffer(stream: unknown): Promise<Buffer> {
    if (stream instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    if (stream instanceof Uint8Array) {
      return Buffer.from(stream);
    }

    if (
      typeof stream === 'object' &&
      stream !== null &&
      'transformToByteArray' in stream
    ) {
      const bytes = await (
        stream as { transformToByteArray: () => Promise<Uint8Array> }
      ).transformToByteArray();
      return Buffer.from(bytes);
    }

    throw new Error('Unsupported Polly audio stream type');
  }
}
