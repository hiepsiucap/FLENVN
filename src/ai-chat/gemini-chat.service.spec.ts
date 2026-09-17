import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiMessageRole } from './ai-message.entity';
import { EnglishLevel } from './dto/create-conversation.dto';
import { GeminiChatService } from './gemini-chat.service';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

describe('GeminiChatService', () => {
  afterEach(() => {
    mockGenerateContent.mockReset();
    jest.clearAllMocks();
  });

  const createService = (project = 'test-project') =>
    new GeminiChatService({
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          'services.vertex.project': project,
          'services.vertex.location': 'global',
          'services.vertex.model': 'gemini-primary',
          'services.vertex.fallbackModel': 'gemini-fallback',
          'services.vertex.maxOutputTokens': 1000,
          'services.aiChat.timeoutMs': 5000,
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService);

  it('maps chat roles and applies optional learning preferences', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Both words relate to speaking.',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 7 },
    });

    await expect(
      createService().generateReply(
        [
          { role: AiMessageRole.USER, content: 'Explain say and tell' },
          { role: AiMessageRole.ASSISTANT, content: 'Certainly.' },
        ],
        'vi',
        EnglishLevel.B1,
      ),
    ).resolves.toEqual({
      content: 'Both words relate to speaking.',
      model: 'gemini-primary',
      inputTokens: 10,
      outputTokens: 7,
    });

    const request = mockGenerateContent.mock.calls[0][0];
    expect(request.contents).toEqual([
      { role: 'user', parts: [{ text: 'Explain say and tell' }] },
      { role: 'model', parts: [{ text: 'Certainly.' }] },
    ]);
    expect(request.config.systemInstruction).toContain('CEFR level B1');
    expect(GoogleGenAI).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'test-project', vertexai: true }),
    );
  });

  it('uses a general instruction when englishLevel is omitted', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Hello!' });
    await createService().generateReply(
      [{ role: AiMessageRole.USER, content: 'Hello' }],
      'vi',
      null,
    );
    expect(
      mockGenerateContent.mock.calls[0][0].config.systemInstruction,
    ).toContain('general English learner');
  });

  it('uses the fallback model when the primary model fails', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('primary unavailable'))
      .mockResolvedValueOnce({ text: 'Fallback answer' });

    await expect(
      createService().generateReply(
        [{ role: AiMessageRole.USER, content: 'Hello' }],
        'vi',
        null,
      ),
    ).resolves.toMatchObject({ model: 'gemini-fallback' });
  });

  it('returns 503 when the provider is not configured', async () => {
    await expect(
      createService('').generateReply(
        [{ role: AiMessageRole.USER, content: 'Hello' }],
        'vi',
        null,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns 503 when both models fail', async () => {
    mockGenerateContent.mockRejectedValue(new Error('unavailable'));
    await expect(
      createService().generateReply(
        [{ role: AiMessageRole.USER, content: 'Hello' }],
        'vi',
        null,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});
