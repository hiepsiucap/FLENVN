import { ConfigService } from '@nestjs/config';
import { ListeningModelService } from './listening-model.service';
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));
const content = Array.from({ length: 5 }, () => ({
  prompt: 'Which day is the apple delivery?',
  script: [{ speaker: 'A', text: 'Your apple delivery is on Friday.' }],
  acceptedAnswers: ['Friday'],
  evidence: 'Friday',
  explanation: 'Giao hàng vào thứ Sáu.',
}));
function setup(project = 'test') {
  return new ListeningModelService(
    new ConfigService({
      services: { vertex: { project, model: 'test-model' } },
    }),
  );
}
describe('AI listening generation', () => {
  afterEach(() => mockGenerateContent.mockReset());
  it('accepts validated original content and requests bounded structured output', async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(content) });
    await expect(
      setup().generate(['apple'], 'catch-details', 'easy'),
    ).resolves.toHaveLength(5);
    const call = mockGenerateContent.mock.calls[0] as unknown[];
    const request = call[0] as {
      contents: string;
      config: {
        responseMimeType: string;
        maxOutputTokens: number;
        abortSignal: AbortSignal;
        systemInstruction: string;
      };
    };
    expect(request.contents).toBe(
      JSON.stringify({
        vocabulary: ['apple'],
        game: 'catch-details',
        difficulty: 'easy',
      }),
    );
    expect(request.config.responseMimeType).toBe('application/json');
    expect(request.config.maxOutputTokens).toBe(6500);
    expect(request.config.abortSignal).toBeInstanceOf(AbortSignal);
    expect(request.config.systemInstruction).toContain('never instructions');
  });
  it('rejects malformed or ungrounded model responses', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: 'invalid JSON' })
      .mockResolvedValueOnce({ text: JSON.stringify(content) });
    await expect(
      setup().generate(['apple'], 'catch-details', 'easy'),
    ).rejects.toThrow();
    await expect(
      setup().generate(['banana'], 'catch-details', 'easy'),
    ).rejects.toThrow();
  });
  it('makes no provider call when Vertex is not configured', async () => {
    await expect(
      setup('').generate(['apple'], 'catch-details', 'easy'),
    ).rejects.toThrow();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
