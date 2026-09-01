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
        signal?.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        });
      });
    }) as jest.MockedFunction<typeof fetch>;

    await expect(service['fetchDictionary']('dalliance')).resolves.toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.dictionaryapi.dev/api/v2/entries/en/dalliance',
      expect.objectContaining({
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    );
  });

  it('starts OpenAI without waiting for Dictionary and preserves the response shape', async () => {
    let resolveDictionary!: (items: never[]) => void;
    const dictionaryPromise = new Promise<never[]>((resolve) => {
      resolveDictionary = resolve;
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
    );
    const internals = service as unknown as {
      fetchDictionary: (word: string) => Promise<never[]>;
      translateSafely: (
        text: string,
        targetLanguage: string,
      ) => Promise<string | undefined>;
    };

    jest.spyOn(internals, 'fetchDictionary').mockReturnValue(dictionaryPromise);
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

    resolveDictionary([]);
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
});
