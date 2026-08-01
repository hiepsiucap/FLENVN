import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PexelsSearchResponse {
  photos?: Array<{
    src?: {
      large2x?: string;
      large?: string;
      medium?: string;
      original?: string;
    };
    alt?: string;
    photographer?: string;
    url?: string;
  }>;
}

interface UnsplashSearchResponse {
  results?: Array<{
    urls?: {
      regular?: string;
      full?: string;
      small?: string;
    };
    alt_description?: string;
    description?: string;
    links?: {
      html?: string;
    };
    user?: {
      name?: string;
    };
  }>;
}

export interface FlashcardImageSuggestion {
  url: string;
  source: 'pexels' | 'unsplash';
  description?: string;
  author?: string;
  sourceUrl?: string;
}

@Injectable()
export class FlashcardImageService {
  private readonly logger = new Logger(FlashcardImageService.name);

  constructor(private readonly configService: ConfigService) {}

  async findImageUrl(word: string): Promise<string | undefined> {
    return (await this.findImageUrls(word, 1))[0]?.url;
  }

  async findImageUrls(
    word: string,
    limit: number = 3,
  ): Promise<FlashcardImageSuggestion[]> {
    const query = word.trim();
    if (!query) return [];

    const pexelsImages = await this.findPexelsImageUrls(query, limit);
    if (pexelsImages.length > 0) return pexelsImages;

    return this.findUnsplashImageUrls(query, limit);
  }

  private async findPexelsImageUrls(
    query: string,
    limit: number,
  ): Promise<FlashcardImageSuggestion[]> {
    const apiKey = this.configService.get<string>('services.pexels.apiKey');
    if (!apiKey) return [];

    try {
      const url = new URL('https://api.pexels.com/v1/search');
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', String(limit));
      url.searchParams.set('orientation', 'landscape');

      const response = await fetch(url, {
        headers: {
          Authorization: apiKey,
        },
      });

      if (!response.ok) {
        this.logger.warn(`Pexels image search failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as PexelsSearchResponse;
      return (data.photos || []).reduce<FlashcardImageSuggestion[]>(
        (images, photo) => {
          const src = photo.src;
          const imageUrl =
            src?.large2x || src?.large || src?.medium || src?.original;

          if (imageUrl) {
            images.push({
              url: imageUrl,
              source: 'pexels',
              description: photo.alt,
              author: photo.photographer,
              sourceUrl: photo.url,
            });
          }

          return images;
        },
        [],
      );
    } catch (error) {
      this.logger.warn(
        `Pexels image search failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return [];
    }
  }

  private async findUnsplashImageUrls(
    query: string,
    limit: number,
  ): Promise<FlashcardImageSuggestion[]> {
    const accessKey = this.configService.get<string>(
      'services.unsplash.accessKey',
    );
    if (!accessKey) return [];

    try {
      const url = new URL('https://api.unsplash.com/search/photos');
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', String(limit));
      url.searchParams.set('orientation', 'landscape');
      url.searchParams.set('client_id', accessKey);

      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(`Unsplash image search failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as UnsplashSearchResponse;
      return (data.results || []).reduce<FlashcardImageSuggestion[]>(
        (images, photo) => {
          const urls = photo.urls;
          const imageUrl = urls?.regular || urls?.full || urls?.small;

          if (imageUrl) {
            images.push({
              url: imageUrl,
              source: 'unsplash',
              description: photo.alt_description || photo.description,
              author: photo.user?.name,
              sourceUrl: photo.links?.html,
            });
          }

          return images;
        },
        [],
      );
    } catch (error) {
      this.logger.warn(
        `Unsplash image search failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return [];
    }
  }
}
