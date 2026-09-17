import { ConfigService } from '@nestjs/config';
import { FlashcardImageService } from './flashcard-image.service';

describe('FlashcardImageService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the tiny Pexels image instead of a larger variant', async () => {
    const config = {
      get: jest.fn().mockReturnValue('pexels-key'),
    } as unknown as ConfigService;
    const service = new FlashcardImageService(config);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        photos: [
          {
            src: {
              tiny: 'https://images.example/tiny.jpg',
              medium: 'https://images.example/medium.jpg',
              large: 'https://images.example/large.jpg',
              large2x: 'https://images.example/large2x.jpg',
            },
          },
        ],
      }),
    } as Response);

    const images = await service.findImageUrls('apple', 1);

    expect(images[0]?.url).toBe('https://images.example/tiny.jpg');
  });

  it('uses the thumbnail Unsplash image instead of a larger variant', async () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'services.unsplash.accessKey' ? 'unsplash-key' : undefined,
      ),
    } as unknown as ConfigService;
    const service = new FlashcardImageService(config);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            urls: {
              thumb: 'https://images.example/thumb.jpg',
              small: 'https://images.example/small.jpg',
              regular: 'https://images.example/regular.jpg',
              full: 'https://images.example/full.jpg',
            },
          },
        ],
      }),
    } as Response);

    const images = await service.findImageUrls('apple', 1);

    expect(images[0]?.url).toBe('https://images.example/thumb.jpg');
  });
});
