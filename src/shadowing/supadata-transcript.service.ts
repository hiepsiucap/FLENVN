import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SupadataTranscriptCue {
  text: string;
  offset: number;
  duration: number;
  lang?: string;
}

export interface SupadataTranscriptResult {
  language: string;
  cues: SupadataTranscriptCue[];
}

interface SupadataResponse {
  lang?: string;
  content?: unknown;
}

@Injectable()
export class SupadataTranscriptService {
  private readonly logger = new Logger(SupadataTranscriptService.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchTranscript(
    videoUrl: string,
    requestedLanguage: string,
  ): Promise<SupadataTranscriptResult> {
    const apiKey = this.configService.get<string>('services.supadata.apiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Shadowing transcript provider is not configured',
      );
    }

    const endpoint = new URL(
      '/v1/youtube/transcript',
      this.configService.get<string>(
        'services.supadata.baseUrl',
        'https://api.supadata.ai',
      ),
    );
    endpoint.searchParams.set('url', videoUrl);
    endpoint.searchParams.set('lang', this.baseLanguage(requestedLanguage));
    endpoint.searchParams.set('text', 'false');

    return this.parseTranscript(
      await this.request(endpoint, apiKey),
      requestedLanguage,
    );
  }

  private async request(url: URL, apiKey: string): Promise<SupadataResponse> {
    const timeoutMs = this.configService.get<number>(
      'services.supadata.requestTimeoutMs',
      15000,
    );
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'x-api-key': apiKey },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.warn(
        `Supadata request failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw new BadGatewayException('Transcript provider is unavailable');
    }

    const body = (await response.json().catch(() => ({}))) as SupadataResponse;
    if (response.status === 404) {
      throw new NotFoundException('No transcript is available for this video');
    }
    if (!response.ok) {
      this.logger.warn(`Supadata returned HTTP ${response.status}`);
      throw new BadGatewayException('Transcript provider request failed');
    }
    return body;
  }

  private parseTranscript(
    response: SupadataResponse,
    requestedLanguage: string,
  ): SupadataTranscriptResult {
    if (!Array.isArray(response.content)) {
      throw new NotFoundException('No transcript is available for this video');
    }

    const language =
      response.lang?.trim() || this.baseLanguage(requestedLanguage);
    const cues = response.content.flatMap<SupadataTranscriptCue>((item) => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Record<string, unknown>;
      const text =
        typeof candidate.text === 'string' ? candidate.text.trim() : '';
      const offset = Number(candidate.offset);
      const duration = Number(candidate.duration);
      if (!text || !Number.isFinite(offset) || !Number.isFinite(duration)) {
        return [];
      }
      return [
        { text, offset, duration: Math.max(duration, 0), lang: language },
      ];
    });

    if (cues.length === 0) {
      throw new NotFoundException('No transcript is available for this video');
    }
    return { language, cues };
  }

  private baseLanguage(language: string): string {
    return language.trim().toLowerCase().split('-')[0] || 'en';
  }
}
