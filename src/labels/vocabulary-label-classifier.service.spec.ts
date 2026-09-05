import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { FlashCard } from '../flashcards/flashcard.entity';
import { LabelType } from './label.entity';
import { VocabularyLabelClassifierService } from './vocabulary-label-classifier.service';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

describe('VocabularyLabelClassifierService', () => {
  let service: VocabularyLabelClassifierService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockReset();
    const values: Record<string, unknown> = {
      'services.vertex.project': 'test-project',
      'services.vertex.location': 'global',
      'services.vertex.model': 'gemini-test',
      'services.vertex.fallbackModel': 'gemini-fallback',
      'services.autoLabeling.geminiTimeoutMs': 20000,
    };
    const configService = {
      get: jest.fn((key: string, fallback: unknown) => values[key] ?? fallback),
    } as unknown as ConfigService;
    service = new VocabularyLabelClassifierService(configService);
  });

  it('returns only controlled labels from structured output', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        topics: ['travel', 'not-in-taxonomy'],
        level: 'B1',
        usage: ['informal'],
      }),
    });

    const result = await service.classify({
      word: 'reservation',
      definition: 'An arrangement to keep something for later.',
      translation: 'sự đặt chỗ',
      example: 'I made a reservation.',
      partOfSpeech: null,
    } as FlashCard);

    expect(result).toEqual([
      { name: 'travel', type: LabelType.TOPIC },
      { name: 'B1', type: LabelType.LEVEL },
      { name: 'informal', type: LabelType.USAGE },
    ]);
    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback model after an invalid primary response', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: '{}' })
      .mockResolvedValueOnce({
        text: JSON.stringify({ topics: [], level: 'A1', usage: [] }),
      });

    const result = await service.classify({
      word: 'cat',
      definition: 'A small domesticated animal.',
      translation: 'con mèo',
      example: 'The cat is sleeping.',
      partOfSpeech: null,
    } as FlashCard);

    expect(result).toEqual([{ name: 'A1', type: LabelType.LEVEL }]);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(mockGenerateContent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: 'gemini-fallback' }),
    );
  });
});
