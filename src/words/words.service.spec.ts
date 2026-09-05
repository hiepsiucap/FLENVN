import { ConfigService } from '@nestjs/config';
import { WordsService } from './words.service';

describe('WordsService', () => {
  const originalFetch = global.fetch;
  const availableVocabulary = {
    findByWord: jest.fn().mockResolvedValue(null),
    wordAlreadyExists: jest.fn(),
  };

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns no pronunciation when Datamuse times out', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) =>
        key === 'DICTIONARY_API_TIMEOUT_MS' ? 10 : defaultValue,
      ),
    } as unknown as ConfigService;

    const service = new WordsService(
      configService,
      {} as never,
      availableVocabulary as never,
      {} as never,
      {} as never,
      {} as never,
    );

    global.fetch = jest.fn((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        });
      });
    }) as jest.MockedFunction<typeof fetch>;

    await expect(
      service['fetchPronunciation']('dalliance'),
    ).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://api.datamuse.com/words?sp=dalliance&md=r&ipa=1&max=1',
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    );
  });

  it('starts AI generation without waiting for pronunciation and preserves the response shape', async () => {
    let resolvePronunciation!: (value: string | undefined) => void;
    const pronunciationPromise = new Promise<string | undefined>((resolve) => {
      resolvePronunciation = resolve;
    });

    const audioService = {
      createAudioUrl: jest.fn().mockResolvedValue(undefined),
    };
    const imageService = {
      findImageUrls: jest.fn().mockResolvedValue([]),
    };
    const exampleService = {
      generateSuggestions: jest.fn().mockResolvedValue([
        {
          partOfSpeech: 'verb',
          definition: 'To examine something.',
          translation: 'kiem tra',
          example: 'Please check the answer.',
          exampleTranslation: 'Vui long kiem tra cau tra loi.',
        },
      ]),
    };
    const service = new WordsService(
      {
        get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      } as unknown as ConfigService,
      audioService as never,
      imageService as never,
      {} as never,
      exampleService as never,
      availableVocabulary as never,
    );
    const internals = service as unknown as {
      fetchPronunciation: (word: string) => Promise<string | undefined>;
      translateSafely: (
        text: string,
        targetLanguage: string,
      ) => Promise<string | undefined>;
    };

    jest
      .spyOn(internals, 'fetchPronunciation')
      .mockReturnValue(pronunciationPromise);
    const wordTranslationSpy = jest
      .spyOn(internals, 'translateSafely')
      .mockResolvedValue('kiem tra');

    const resultPromise = service.suggestWord('user-id', {
      word: 'test',
      targetLanguage: 'vi',
      imageLimit: 3,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(wordTranslationSpy).toHaveBeenCalled();
    expect(audioService.createAudioUrl).toHaveBeenCalled();
    expect(imageService.findImageUrls).toHaveBeenCalled();
    expect(exampleService.generateSuggestions).toHaveBeenCalledWith(
      'test',
      'vi',
    );

    resolvePronunciation('tɛst');
    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({
        word: 'test',
        definitions: [{ text: 'To examine something.', partOfSpeech: 'verb' }],
        examples: [
          expect.objectContaining({
            text: 'Please check the answer.',
            translation: 'Vui long kiem tra cau tra loi.',
          }),
        ],
        suggestions: [
          expect.objectContaining({
            translation: 'kiem tra',
            definition: {
              text: 'To examine something.',
              partOfSpeech: 'verb',
            },
          }),
        ],
      }),
    );
  });

  it('explains an inflected word using its original context sentence', async () => {
    const audioService = {
      createAudioUrl: jest.fn().mockResolvedValue('https://audio.test/run.mp3'),
    };
    const imageService = {
      findImageUrls: jest.fn().mockResolvedValue([]),
    };
    const exampleService = {
      explainInContext: jest.fn().mockResolvedValue({
        partOfSpeech: 'verb',
        definition: 'To move quickly on foot.',
        translation: 'chạy',
        exampleTranslation: 'Họ đang chạy trong công viên.',
        explanation: 'Từ này diễn tả hành động di chuyển nhanh bằng chân.',
        example: 'They were running in the park.',
        generatedExample: false,
        source: 'vertex',
      }),
    };
    const service = new WordsService(
      {
        get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      } as unknown as ConfigService,
      audioService as never,
      imageService as never,
      {} as never,
      exampleService as never,
      availableVocabulary as never,
    );
    jest
      .spyOn(
        service as unknown as {
          fetchPronunciation: (word: string) => Promise<string | undefined>;
        },
        'fetchPronunciation',
      )
      .mockResolvedValue('rʌn');

    await expect(
      service.explainWordInContext('user-id', {
        text: 'It was sunny. They were running in the park. Then it rained.',
        word: 'run',
        targetLanguage: 'vi',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        word: 'run',
        matchedForm: 'running',
        contextSentence: 'They were running in the park.',
        example: 'They were running in the park.',
        generatedExample: false,
        pronunciation: 'rʌn',
        translation: 'chạy',
        source: 'generated',
      }),
    );
    expect(exampleService.explainInContext).toHaveBeenCalledWith(
      'run',
      'running',
      'It was sunny. They were running in the park. Then it rained.',
      'They were running in the park.',
      'vi',
    );
  });

  it('rejects context that does not contain the requested word', async () => {
    const service = new WordsService(
      {
        get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      } as unknown as ConfigService,
      {} as never,
      availableVocabulary as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.explainWordInContext('user-id', {
        text: 'The weather is pleasant today.',
        word: 'bank',
      }),
    ).rejects.toThrow('was not found');
  });

  it('returns an existing database flashcard without calling external APIs', async () => {
    const existingFlashcard = {
      id: 'card-1',
      word: 'bank',
      pronunciation: 'bæŋk',
      partOfSpeech: 'noun',
      definition: 'A financial institution that manages money.',
      translation: 'ngân hàng',
      example: 'I deposited money at the bank.',
      exampleTranslation: 'Tôi đã gửi tiền vào ngân hàng.',
      audioUrl: 'https://audio.test/bank.mp3',
      imageUrl: 'https://image.test/bank.jpg',
    };
    const audioService = { createAudioUrl: jest.fn() };
    const imageService = { findImageUrls: jest.fn() };
    const translationService = { translateText: jest.fn() };
    const exampleService = {
      generateSuggestions: jest.fn(),
      explainInContext: jest.fn(),
    };
    const vocabularyService = {
      findByWord: jest.fn().mockResolvedValue(existingFlashcard),
    };
    const service = new WordsService(
      {
        get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      } as unknown as ConfigService,
      audioService as never,
      imageService as never,
      translationService as never,
      exampleService as never,
      vocabularyService as never,
    );

    await expect(
      service.suggestWord('user-1', { word: 'BANK' }),
    ).resolves.toEqual(
      expect.objectContaining({
        existing: true,
        existingFlashcardId: 'card-1',
        source: 'database',
        translation: 'ngân hàng',
      }),
    );
    await expect(
      service.explainWordInContext('user-1', {
        text: 'She visited the bank yesterday.',
        word: 'bank',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        existing: true,
        existingFlashcardId: 'card-1',
        source: 'database',
        contextSentence: 'She visited the bank yesterday.',
        translation: 'ngân hàng',
      }),
    );

    expect(exampleService.generateSuggestions).not.toHaveBeenCalled();
    expect(exampleService.explainInContext).not.toHaveBeenCalled();
    expect(audioService.createAudioUrl).not.toHaveBeenCalled();
    expect(imageService.findImageUrls).not.toHaveBeenCalled();
    expect(translationService.translateText).not.toHaveBeenCalled();
  });
});
