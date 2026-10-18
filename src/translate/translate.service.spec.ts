import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { TranslateService } from './translate.service';

const mockGenerateContent = jest.fn(
  (request: { model: string; contents: string }) =>
    Promise.resolve({ text: request.contents }),
);

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

describe('TranslateService', () => {
  afterEach(() => {
    mockGenerateContent.mockReset();
    jest.clearAllMocks();
  });

  const createService = (project: string | undefined = 'test-project') =>
    new TranslateService({
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          'services.vertex.project': project,
          'services.vertex.location': 'global',
          'services.vertex.model': 'gemini-primary',
          'services.vertex.fallbackModel': 'gemini-fallback',
        };
        return values[key] ?? defaultValue;
      }),
    } as unknown as ConfigService);

  it('uses context but asks Gemini to translate only text', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        translatedText: 'bờ sông',
        sourceLanguage: 'en',
      }),
    });

    await expect(
      createService().translateText({
        text: 'bank',
        context: 'We sat on the bank of the river.',
        sourceLanguage: 'en',
        targetLanguage: 'vi',
      }),
    ).resolves.toEqual({
      translatedText: 'bờ sông',
      sourceLanguage: 'en',
      targetLanguage: 'vi',
      provider: 'gemini',
    });

    const request = mockGenerateContent.mock.calls[0][0];
    expect(request.contents).toContain('We sat on the bank of the river.');
    expect(request.contents).toContain('Translate only the value of "text"');
    expect(GoogleGenAI).toHaveBeenCalledWith(
      expect.objectContaining({ vertexai: true, project: 'test-project' }),
    );
  });

  it('works without context', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        translatedText: 'Xin chào',
        sourceLanguage: 'en',
      }),
    });

    await expect(
      createService().translateText({
        text: 'Hello',
        targetLanguage: 'vi',
      }),
    ).resolves.toMatchObject({ translatedText: 'Xin chào' });
  });

  it('returns tone-marked pinyin for Chinese source text', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        translatedText: 'hello',
        sourceLanguage: 'zh',
        sourcePinyin: 'nǐ hǎo',
      }),
    });

    await expect(
      createService().translateText({ text: '你好', targetLanguage: 'en' }),
    ).resolves.toMatchObject({ sourcePinyin: 'nǐ hǎo' });
    expect(mockGenerateContent.mock.calls[0][0].contents).toContain(
      'Hanyu Pinyin',
    );
  });

  it('returns pinyin for a Chinese translation', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        translatedText: '你好',
        sourceLanguage: 'en',
        translatedPinyin: 'nǐ hǎo',
      }),
    });

    await expect(
      createService().translateText({ text: 'hello', targetLanguage: 'zh-CN' }),
    ).resolves.toMatchObject({ translatedPinyin: 'nǐ hǎo' });
  });

  it('tries the fallback model when a Chinese result has no pinyin', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        text: JSON.stringify({ translatedText: 'hello', sourceLanguage: 'zh' }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          translatedText: 'hello',
          sourceLanguage: 'zh',
          sourcePinyin: 'nǐ hǎo',
        }),
      });

    await expect(
      createService().translateText({ text: '你好', targetLanguage: 'en' }),
    ).resolves.toMatchObject({ sourcePinyin: 'nǐ hǎo' });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('falls back to the secondary Gemini model', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce({
        text: JSON.stringify({
          translatedText: 'Xin chào',
          sourceLanguage: 'en',
        }),
      });

    await createService().translateText({
      text: 'Hello',
      targetLanguage: 'vi',
    });

    expect(mockGenerateContent.mock.calls[1][0].model).toBe('gemini-fallback');
  });

  it('fails clearly when Vertex AI is not configured', async () => {
    await expect(
      createService('').translateText({
        text: 'Hello',
        targetLanguage: 'vi',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
