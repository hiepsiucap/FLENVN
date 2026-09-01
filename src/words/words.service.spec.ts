import { ConfigService } from '@nestjs/config';
import { WordsService } from './words.service';

describe('WordsService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns no dictionary results when the upstream request times out', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) =>
        key === 'DICTIONARY_API_TIMEOUT_MS' ? 10 : defaultValue,
      ),
    } as unknown as ConfigService;

    const service = new WordsService(
      configService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    global.fetch = jest.fn((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      });
    }) as jest.MockedFunction<typeof fetch>;

    await expect(service['fetchDictionary']('dalliance')).resolves.toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.dictionaryapi.dev/api/v2/entries/en/dalliance',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('starts independent work and definition translation without waiting for examples', async () => {
    let resolveExamples!: (examples: never[]) => void;
    const examplesPromise = new Promise<never[]>((resolve) => {
      resolveExamples = resolve;
    });

    const audioService = {
      createAudioUrl: jest.fn().mockResolvedValue(undefined),
    };
    const imageService = {
      findImageUrls: jest.fn().mockResolvedValue([]),
    };
    const exampleService = {
      generateExamples: jest.fn().mockReturnValue(examplesPromise),
    };
    const service = new WordsService(
      {
        get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      } as unknown as ConfigService,
      audioService as never,
      imageService as never,
      {} as never,
      exampleService as never,
    );
    const internals = service as unknown as {
      fetchDictionary: (word: string) => Promise<never[]>;
      translateSafely: (
        text: string,
        targetLanguage: string,
      ) => Promise<string | undefined>;
      translateDefinitionsWithOpenAi: (
        word: string,
        definitions: never[],
        targetLanguage: string,
      ) => Promise<string[]>;
      translateExamples: (
        examples: never[],
        targetLanguage: string,
      ) => Promise<string[]>;
    };

    jest.spyOn(internals, 'fetchDictionary').mockResolvedValue([]);
    const wordTranslationSpy = jest
      .spyOn(internals, 'translateSafely')
      .mockResolvedValue('kiểm tra');
    const definitionTranslationSpy = jest
      .spyOn(internals, 'translateDefinitionsWithOpenAi')
      .mockResolvedValue([]);
    jest.spyOn(internals, 'translateExamples').mockResolvedValue([]);

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
    expect(exampleService.generateExamples).toHaveBeenCalled();
    expect(definitionTranslationSpy).toHaveBeenCalled();

    resolveExamples([]);
    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({ word: 'test' }),
    );
  });
});
