import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupadataTranscriptService } from './supadata-transcript.service';

describe('SupadataTranscriptService', () => {
  const values: Record<string, unknown> = {
    'services.supadata.apiKey': 'test-key',
    'services.supadata.baseUrl': 'https://api.supadata.ai',
    'services.supadata.requestTimeoutMs': 15000,
  };
  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key in values ? values[key] : defaultValue,
    ),
  };
  const service = new SupadataTranscriptService(configService as never);

  afterEach(() => {
    jest.restoreAllMocks();
    values['services.supadata.apiKey'] = 'test-key';
  });

  it('fetches timestamped cues and normalizes a regional language', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        lang: 'en',
        content: [
          { text: ' Hello world. ', offset: 1250, duration: 900, lang: 'en' },
        ],
      }),
    } as Response);

    await expect(
      service.fetchTranscript(
        'https://www.youtube.com/watch?v=AkJMFL3pMHg',
        'en-GB',
      ),
    ).resolves.toEqual({
      language: 'en',
      cues: [{ text: 'Hello world.', offset: 1250, duration: 900, lang: 'en' }],
    });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/v1/youtube/transcript?');
    expect(String(url)).toContain('lang=en');
    expect(String(url)).toContain('text=false');
    expect(options?.headers).toEqual({ 'x-api-key': 'test-key' });
  });

  it('requires a configured API key', async () => {
    values['services.supadata.apiKey'] = '';
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      service.fetchTranscript('https://youtu.be/AkJMFL3pMHg', 'en'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps a missing transcript to not found', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);

    await expect(
      service.fetchTranscript('https://youtu.be/AkJMFL3pMHg', 'en'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps provider errors to bad gateway', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    await expect(
      service.fetchTranscript('https://youtu.be/AkJMFL3pMHg', 'en'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
