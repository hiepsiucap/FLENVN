import { ServiceUnavailableException } from '@nestjs/common';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardAudioService } from './flashcard-audio.service';

describe('flashcard audio suggestions', () => {
  const createAudioUrl = jest.fn();
  const controller = new FlashcardsController(
    {} as never,
    {} as never,
    { createAudioUrl } as unknown as FlashcardAudioService,
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
});
