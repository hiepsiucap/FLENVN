import { NotFoundException } from '@nestjs/common';
import { VocabularyCollectorService } from './vocabulary-collector.service';
import { VocabularyCandidateType } from './dto/collect-vocabulary.dto';

describe('VocabularyCollectorService', () => {
  const conversation = {
    id: 'conversation-1',
    userId: 'user-1',
    targetLanguage: 'vi',
    englishLevel: null,
  };
  const conversationRepository = { findOne: jest.fn() };
  const messageRepository = { find: jest.fn() };
  const booksService = { getBookById: jest.fn() };
  const flashcardsService = {
    findByWord: jest.fn(),
    createFlashcard: jest.fn(),
  };
  const model = { discover: jest.fn() };
  const images = { findImageUrl: jest.fn() };
  const service = new VocabularyCollectorService(
    conversationRepository as never,
    messageRepository as never,
    booksService as never,
    flashcardsService as never,
    model as never,
    images as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    conversationRepository.findOne.mockResolvedValue(conversation);
    messageRepository.find.mockResolvedValue([
      { role: 'user', content: 'I need to break the ice.' },
    ]);
    flashcardsService.findByWord.mockResolvedValue(null);
    images.findImageUrl.mockResolvedValue(undefined);
    booksService.getBookById.mockResolvedValue({
      id: 'book-1',
      userId: 'user-1',
    });
  });

  it('rejects extraction of a conversation owned by another user', async () => {
    conversationRepository.findOne.mockResolvedValue(null);
    await expect(
      service.discoverConversation('user-1', 'conversation-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(model.discover).not.toHaveBeenCalled();
  });

  it('marks existing cards and removes repeated candidates', async () => {
    model.discover.mockResolvedValue([
      {
        text: 'Break the ice',
        type: VocabularyCandidateType.IDIOM,
        translation: 'phá băng',
        definition: 'Start a conversation',
        example: 'I need to break the ice.',
        recommended: true,
      },
      {
        text: ' break the ice! ',
        type: VocabularyCandidateType.IDIOM,
        translation: 'phá băng',
        definition: 'Start a conversation',
      },
    ]);
    flashcardsService.findByWord.mockResolvedValue({
      id: 'card-1',
      bookId: 'book-1',
    });
    const result = await service.discoverConversation(
      'user-1',
      'conversation-1',
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      source: 'conversation',
      alreadyExists: true,
      existingFlashcardId: 'card-1',
    });
    expect(images.findImageUrl).not.toHaveBeenCalled();
  });

  it('does not present invented examples as conversation quotes', async () => {
    model.discover.mockResolvedValue([
      {
        text: 'break the ice',
        type: VocabularyCandidateType.IDIOM,
        translation: 'phá băng',
        definition: 'Start a conversation',
        example: 'She broke the ice at the party.',
      },
    ]);
    const result = await service.discoverConversation(
      'user-1',
      'conversation-1',
    );
    expect(result.candidates[0].example).toBeUndefined();
  });

  it('suggests an image URL for a new vocabulary candidate', async () => {
    model.discover.mockResolvedValue([
      {
        text: 'apple',
        type: VocabularyCandidateType.WORD,
        translation: 'táo',
        definition: 'A fruit',
      },
    ]);
    images.findImageUrl.mockResolvedValue('https://images.example/apple.jpg');

    const result = await service.discoverTopic('user-1', 'fruit');

    expect(images.findImageUrl).toHaveBeenCalledWith('apple');
    expect(result.candidates[0].imageUrl).toBe(
      'https://images.example/apple.jpg',
    );
  });

  it('still returns vocabulary when image search fails', async () => {
    model.discover.mockResolvedValue([
      {
        text: 'apple',
        type: VocabularyCandidateType.WORD,
        translation: 'táo',
        definition: 'A fruit',
      },
    ]);
    images.findImageUrl.mockRejectedValue(
      new Error('Image provider unavailable'),
    );

    const result = await service.discoverTopic('user-1', 'fruit');

    expect(result.candidates[0]).toMatchObject({ text: 'apple' });
    expect(result.candidates[0].imageUrl).toBeUndefined();
  });

  it('passes a reviewed image URL to flashcard creation', async () => {
    flashcardsService.createFlashcard.mockResolvedValue({ id: 'card-1' });
    const request = {
      bookId: 'book-1',
      candidates: [
        {
          text: 'apple',
          type: VocabularyCandidateType.WORD,
          translation: 'táo',
          definition: 'A fruit',
          imageUrl: 'https://images.example/apple.jpg',
        },
      ],
    };

    await service.save('user-1', request);

    expect(flashcardsService.createFlashcard).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ imageUrl: 'https://images.example/apple.jpg' }),
    );
  });

  it('verifies book ownership before saving any card', async () => {
    booksService.getBookById.mockResolvedValue(null);
    await expect(
      service.save('user-1', {
        bookId: 'book-1',
        candidates: [
          {
            text: 'hello',
            type: VocabularyCandidateType.WORD,
            translation: 'xin chào',
            definition: 'a greeting',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(flashcardsService.createFlashcard).not.toHaveBeenCalled();
  });

  it('reports partial saves and leaves failed candidates available to retry', async () => {
    flashcardsService.createFlashcard
      .mockResolvedValueOnce({ id: 'card-1' })
      .mockRejectedValueOnce(new Error('limit reached'));
    const result = await service.save('user-1', {
      bookId: 'book-1',
      candidates: [
        {
          text: 'hello',
          type: VocabularyCandidateType.WORD,
          translation: 'xin chào',
          definition: 'a greeting',
        },
        {
          text: 'break the ice',
          type: VocabularyCandidateType.IDIOM,
          translation: 'phá băng',
          definition: 'start talking',
        },
      ],
    });
    expect(result).toMatchObject({ saved: 1, duplicates: 0, failed: 1 });
    expect(result.results[1]).toMatchObject({
      text: 'break the ice',
      status: 'failed',
    });
  });
});
