import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TranslateTextCommand,
  TranslateClient,
} from '@aws-sdk/client-translate';
import { TranslateTextDto } from './dto/translate-text.dto';

@Injectable()
export class TranslateService {
  private readonly client: TranslateClient;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('services.aws.region') ||
      this.configService.get<string>('AWS_REGION') ||
      'us-east-1';

    const accessKeyId = this.configService.get<string>(
      'services.aws.accessKeyId',
    );
    const secretAccessKey = this.configService.get<string>(
      'services.aws.secretAccessKey',
    );

    this.client = new TranslateClient({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

  async translateText(dto: TranslateTextDto) {
    if (!dto.text.trim()) {
      throw new BadRequestException('Text must not be empty');
    }

    try {
      const command = new TranslateTextCommand({
        Text: dto.text,
        SourceLanguageCode: dto.sourceLanguage || 'auto',
        TargetLanguageCode: dto.targetLanguage,
      });

      const result = await this.client.send(command);

      return {
        translatedText: result.TranslatedText || '',
        sourceLanguage:
          result.SourceLanguageCode || dto.sourceLanguage || 'auto',
        targetLanguage: result.TargetLanguageCode || dto.targetLanguage,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Translation failed',
      );
    }
  }
}
