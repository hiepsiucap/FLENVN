import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateBookBackgroundDto } from './dto/generate-book-background.dto';

interface PexelsResponse {
  photos?: Array<{
    src?: { large2x?: string; large?: string; medium?: string };
    alt?: string;
    photographer?: string;
    url?: string;
  }>;
}
interface UnsplashResponse {
  results?: Array<{
    urls?: { regular?: string; full?: string; small?: string };
    alt_description?: string;
    description?: string;
    links?: { html?: string };
    user?: { name?: string };
  }>;
}

export interface BookBackgroundSuggestion {
  imageUrl: string;
  mimeType: 'image/jpeg';
  prompt: string;
  source: 'pexels' | 'unsplash';
  description?: string;
  author?: string;
  sourceUrl?: string;
}

@Injectable()
export class BookBackgroundService {
  private readonly logger = new Logger(BookBackgroundService.name);
  constructor(private readonly configService: ConfigService) {}

  async generateBackgrounds(
    _userId: string,
    dto: GenerateBookBackgroundDto,
  ): Promise<{ backgrounds: BookBackgroundSuggestion[] }> {
    const count = dto.count ?? 3;
    const query = [dto.title.trim(), dto.description?.trim()]
      .filter(Boolean)
      .join(' ');
    const [pexels, unsplash] = await Promise.all([
      this.searchPexels(query, count),
      this.searchUnsplash(query, count),
    ]);
    const backgrounds = [...pexels, ...unsplash].slice(0, count);
    if (!backgrounds.length)
      throw new ServiceUnavailableException(
        'No image providers are configured or available',
      );
    return { backgrounds };
  }

  private async searchPexels(
    query: string,
    count: number,
  ): Promise<BookBackgroundSuggestion[]> {
    const apiKey = this.configService.get<string>('services.pexels.apiKey');
    if (!apiKey) return [];
    try {
      const url = new URL('https://api.pexels.com/v1/search');
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', String(count));
      url.searchParams.set('orientation', 'landscape');
      const response = await fetch(url, { headers: { Authorization: apiKey } });
      if (!response.ok) return [];
      const data = (await response.json()) as PexelsResponse;
      return (data.photos || []).flatMap((photo) => {
        const imageUrl =
          photo.src?.large2x || photo.src?.large || photo.src?.medium;
        return imageUrl
          ? [
              {
                imageUrl,
                mimeType: 'image/jpeg' as const,
                prompt: query,
                source: 'pexels' as const,
                description: photo.alt,
                author: photo.photographer,
                sourceUrl: photo.url,
              },
            ]
          : [];
      });
    } catch (error) {
      this.logger.warn(
        `Pexels search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  private async searchUnsplash(
    query: string,
    count: number,
  ): Promise<BookBackgroundSuggestion[]> {
    const accessKey = this.configService.get<string>(
      'services.unsplash.accessKey',
    );
    if (!accessKey) return [];
    try {
      const url = new URL('https://api.unsplash.com/search/photos');
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', String(count));
      url.searchParams.set('orientation', 'landscape');
      url.searchParams.set('client_id', accessKey);
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = (await response.json()) as UnsplashResponse;
      return (data.results || []).flatMap((photo) => {
        const imageUrl =
          photo.urls?.regular || photo.urls?.full || photo.urls?.small;
        return imageUrl
          ? [
              {
                imageUrl,
                mimeType: 'image/jpeg' as const,
                prompt: query,
                source: 'unsplash' as const,
                description: photo.alt_description || photo.description,
                author: photo.user?.name,
                sourceUrl: photo.links?.html,
              },
            ]
          : [];
      });
    } catch (error) {
      this.logger.warn(
        `Unsplash search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }
}
