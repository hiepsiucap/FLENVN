import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateBookBackgroundDto } from './dto/generate-book-background.dto';

interface OpenAiImage {
  b64_json?: string;
  revised_prompt?: string;
}

interface OpenAiImagesResponse {
  data?: OpenAiImage[];
  output_format?: 'png' | 'jpeg' | 'webp';
  usage?: unknown;
  error?: {
    message?: string;
    type?: string;
  };
}

export interface BookBackgroundSuggestion {
  imageUrl: string;
  mimeType: string;
  prompt: string;
  revisedPrompt?: string;
  source: 'openai';
}

@Injectable()
export class BookBackgroundService {
  private readonly logger = new Logger(BookBackgroundService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateBackgrounds(
    userId: string,
    dto: GenerateBookBackgroundDto,
  ): Promise<{ backgrounds: BookBackgroundSuggestion[] }> {
    const apiKey = this.configService.get<string>('services.openai.apiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OpenAI image generation is not configured',
      );
    }

    const count = dto.count ?? 3;
    const outputFormat = 'webp';
    const prompt = this.buildPrompt(dto);

    try {
      const response = await fetch(
        'https://api.openai.com/v1/images/generations',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model:
              this.configService.get<string>('services.openai.imageModel') ||
              'gpt-image-1',
            prompt,
            n: count,
            size: dto.size ?? '1536x1024',
            quality: dto.quality ?? 'medium',
            background: 'opaque',
            output_format: outputFormat,
            user: userId,
          }),
        },
      );

      const data = (await response.json()) as OpenAiImagesResponse;

      if (!response.ok) {
        const message = data.error?.message || 'Image generation failed';
        this.logger.warn(`OpenAI image generation failed: ${message}`);

        if (response.status === 400) {
          throw new BadRequestException(message);
        }

        throw new InternalServerErrorException(message);
      }

      const mimeType = `image/${data.output_format || outputFormat}`;
      const backgrounds = (data.data || [])
        .filter((image) => Boolean(image.b64_json))
        .map((image) => ({
          imageUrl: `data:${mimeType};base64,${image.b64_json}`,
          mimeType,
          prompt,
          revisedPrompt: image.revised_prompt,
          source: 'openai' as const,
        }));

      if (backgrounds.length === 0) {
        throw new InternalServerErrorException(
          'Image generation returned no images',
        );
      }

      return { backgrounds };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      this.logger.error(
        error instanceof Error
          ? error.message
          : 'Unknown image generation error',
      );
      throw new InternalServerErrorException('Image generation failed');
    }
  }

  private buildPrompt(dto: GenerateBookBackgroundDto): string {
    const description = dto.description?.trim();
    const descriptionLine = description
      ? `Book description: ${description}`
      : 'Book description: not provided';

    return [
      'Create a polished book cover background image.',
      `Book title: ${dto.title.trim()}`,
      descriptionLine,
      'Design requirements: landscape composition, premium educational publishing style, strong visual focus, no text, no letters, no logos, no watermark, leave clean negative space for a title overlay, suitable as a selectable book background in a learning app.',
    ].join('\n');
  }
}
