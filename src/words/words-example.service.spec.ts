import { ConfigService } from '@nestjs/config';
import { WordsExampleService } from './words-example.service';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

describe('WordsExampleService', () => {
  afterEach(() => {
    mockGenerateContent.mockReset();
    jest.restoreAllMocks();
  });

  const createService = () =>
    new WordsExampleService({
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          'services.vertex.project': 'test-project',
          'services.vertex.location': 'global',
          'services.vertex.model': 'gemini-3.5-flash-lite',
          'services.vertex.fallbackModel': 'gemini-3.5-flash',
        };
        return values[key] ?? defaultValue;
      }),
    } as unknown as ConfigService);

  const validOutput = {
    suggestions: [
      {
        partOfSpeech: 'adjective',
        definition: 'Giving off a lot of light.',
        translation: 'sáng',
        example: 'The room is bright.',
        exampleTranslation: 'Căn phòng sáng.',
      },
    ],
  };

  it('uses Gemini Flash Lite when its result is valid', async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(validOutput) });

    await expect(
      createService().generateSuggestions('bright', 'vi'),
    ).resolves.toEqual(
      validOutput.suggestions.map((suggestion) => ({
        ...suggestion,
        source: 'vertex',
      })),
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent.mock.calls[0][0].model).toBe(
      'gemini-3.5-flash-lite',
    );
  });

  it('uses Gemini Flash fallback when Lite returns unaccented Vietnamese', async () => {
    const unaccentedOutput = {
      suggestions: [
        {
          ...validOutput.suggestions[0],
          translation: 'sang',
          exampleTranslation: 'Can phong sang.',
        },
      ],
    };
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(unaccentedOutput) })
      .mockResolvedValueOnce({ text: JSON.stringify(validOutput) });

    await expect(
      createService().generateSuggestions('bright', 'vi'),
    ).resolves.toEqual(
      validOutput.suggestions.map((suggestion) => ({
        ...suggestion,
        source: 'vertex',
      })),
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(mockGenerateContent.mock.calls[1][0].model).toBe(
      'gemini-3.5-flash',
    );
  });

  it('returns no suggestions when both Vertex models fail', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Vertex unavailable'));

    await expect(
      createService().generateSuggestions('bright', 'vi'),
    ).resolves.toEqual([]);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});
