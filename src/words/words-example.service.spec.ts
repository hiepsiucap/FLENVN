import { ConfigService } from '@nestjs/config';
import { WordsExampleService } from './words-example.service';

describe('WordsExampleService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('generates paired meanings without Dictionary API input', async () => {
    const service = new WordsExampleService({
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'services.openai.apiKey') return 'test-key';
        if (key === 'services.openai.model') return 'gpt-5-nano';
        return defaultValue;
      }),
    } as unknown as ConfigService);
    const output = {
      suggestions: [
        {
          partOfSpeech: 'verb',
          definition: 'To accept that something is true.',
          translation: 'thừa nhận',
          example: 'She acknowledged her mistake.',
          exampleTranslation: 'Cô ấy thừa nhận lỗi của mình.',
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValue({ output_text: JSON.stringify(output) }),
    }) as unknown as jest.MockedFunction<typeof fetch>;

    await expect(
      service.generateSuggestions('acknowledge', 'vi'),
    ).resolves.toEqual(output.suggestions);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const request = (global.fetch as jest.MockedFunction<typeof fetch>).mock
      .calls[0];
    const rawBody = request[1]?.body;
    expect(typeof rawBody).toBe('string');
    if (typeof rawBody !== 'string') throw new Error('Expected JSON body');
    const body = JSON.parse(rawBody) as {
      input: string;
    };
    const input = JSON.parse(body.input) as Record<string, unknown>;

    expect(input).toEqual(
      expect.objectContaining({ word: 'acknowledge', targetLanguage: 'vi' }),
    );
    expect(input).not.toHaveProperty('definitions');
  });
});
