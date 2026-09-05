import { ConflictException, ForbiddenException } from '@nestjs/common';
import { FlashcardsService } from './flashcards.service';

describe('FlashcardsService extension save safeguards', () => {
  const flashcardRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    query: jest.fn(),
  };
  const subscriptionsService = {
    canAddWords: jest.fn(),
    updateUserUsage: jest.fn(),
  };
  const booksService = {
    getBookById: jest.fn(),
  };
  const flashcardImageService = {};
  const flashcardAudioService = {};
  const labelsService = {
    getOwnedLabels: jest.fn(),
    replaceFlashcardLabels: jest.fn(),
  };
  const labelingQueueService = {
    isEnabled: jest.fn().mockReturnValue(false),
    publish: jest.fn(),
  };

  let service: FlashcardsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new FlashcardsService(
      flashcardRepository as never,
      subscriptionsService as never,
      booksService as never,
      flashcardImageService as never,
      flashcardAudioService as never,
      labelsService as never,
      labelingQueueService as never,
    );
  });

  it('returns a conflict before consuming quota for an existing word', async () => {
    flashcardRepository.findOne.mockResolvedValue({ id: 'existing-card' });

    await expect(
      service.createFlashcard('user-1', {
        word: 'resilient',
        bookId: 'book-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(subscriptionsService.canAddWords).not.toHaveBeenCalled();
    expect(flashcardRepository.save).not.toHaveBeenCalled();
  });

  it('does not allow saving into a public book owned by another user', async () => {
    flashcardRepository.findOne.mockResolvedValue(null);
    subscriptionsService.canAddWords.mockResolvedValue(true);
    booksService.getBookById.mockResolvedValue({
      id: 'public-book',
      userId: 'other-user',
      isPublic: true,
    });

    await expect(
      service.createFlashcard('user-1', {
        word: 'resilient',
        bookId: 'public-book',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(flashcardRepository.save).not.toHaveBeenCalled();
  });
});
