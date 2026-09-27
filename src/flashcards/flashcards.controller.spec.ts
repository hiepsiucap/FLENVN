import { ServiceUnavailableException } from '@nestjs/common';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardAudioService } from './flashcard-audio.service';
import { FlashcardImageService } from './flashcard-image.service';

describe('flashcard media suggestions', () => {
  const createAudioUrl = jest.fn();
  const findImageUrls = jest.fn();
  const controller = new FlashcardsController(
    {} as never,
    {} as never,
    { createAudioUrl } as unknown as FlashcardAudioService,
    { findImageUrls } as unknown as FlashcardImageService,
  );

  beforeEach(() => createAudioUrl.mockReset());

  it('generates audio for the authenticated user', async () => {
    createAudioUrl.mockResolvedValue('https://cdn.test/word.mp3');
    await expect(
      controller.suggestAudio({ user: { id: 'user-1' } } as never, {
        text: 'apple',
      }),
    ).resolves.toEqual({ url: 'https://cdn.test/word.mp3' });
    expect(createAudioUrl).toHaveBeenCalledWith('user-1', 'apple');
  });

  it('reports when synthesis is unavailable', async () => {
    createAudioUrl.mockResolvedValue(undefined);
    await expect(
      controller.suggestAudio({ user: { id: 'user-1' } } as never, {
        text: 'apple',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('searches fresh images for an existing flashcard word', async () => {
    const images = [
      { url: 'https://images.pexels.com/fresh.jpg', source: 'pexels' },
    ];
    findImageUrls.mockResolvedValue(images);
    await expect(
      controller.suggestImages(
        { user: { id: 'user-1' } } as never,
        'apple',
        '6',
      ),
    ).resolves.toEqual({ images });
    expect(findImageUrls).toHaveBeenCalledWith('apple', 6);
  });
});
