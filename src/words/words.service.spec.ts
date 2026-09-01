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
});
