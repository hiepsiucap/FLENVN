import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ShadowingService } from './shadowing.service';

describe('ShadowingService', () => {
  const supadataTranscriptService = { fetchTranscript: jest.fn() };
  const service = new ShadowingService(supadataTranscriptService as never);

  beforeEach(() => {
    supadataTranscriptService.fetchTranscript.mockReset();
    supadataTranscriptService.fetchTranscript.mockResolvedValue({
      language: 'en',
      cues: [{ text: 'Hello.', offset: 0, duration: 500, lang: 'en' }],
    });
  });

  afterEach(() => jest.restoreAllMocks());

  const mockTitle = (title = 'Video title') =>
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ title }),
    } as Response);

  it('returns title and short timestamped sentences from Supadata', async () => {
    supadataTranscriptService.fetchTranscript.mockResolvedValue({
      language: 'en',
      cues: [
        { text: 'This is a short sentence.', offset: 0, duration: 2000 },
        {
          text: 'This caption has more words than we want in one shadowing sentence',
          offset: 2000,
          duration: 4000,
        },
      ],
    });
    mockTitle('A useful English lesson');

    const result = await service.prepare({
      url: 'https://youtu.be/k2h8PvLY6D4',
      language: 'en-GB',
      maxWordsPerSentence: 5,
    });

    expect(supadataTranscriptService.fetchTranscript).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=k2h8PvLY6D4',
      'en-GB',
    );
    expect(result.title).toBe('A useful English lesson');
    expect(result.transcriptSource).toBe('supadata');
    expect(result.language).toBe('en');
    expect(
      result.sentences.every((item) => item.text.split(/\s+/).length <= 5),
    ).toBe(true);
  });

  it('rejects non-YouTube links before calling Supadata', async () => {
    await expect(
      service.prepare({ url: 'https://example.com/video' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(supadataTranscriptService.fetchTranscript).not.toHaveBeenCalled();
  });

  it.each([
    'https://www.youtube.com/watch?v=k2h8PvLY6D4',
    'https://m.youtube.com/watch?v=k2h8PvLY6D4',
    'https://music.youtube.com/watch?v=k2h8PvLY6D4',
    'https://youtu.be/k2h8PvLY6D4',
    'https://www.youtube.com/shorts/k2h8PvLY6D4',
    'https://www.youtube.com/embed/k2h8PvLY6D4',
    'https://www.youtube.com/live/k2h8PvLY6D4',
  ])('accepts supported YouTube URL %s', async (url) => {
    mockTitle();
    const result = await service.prepare({ url });
    expect(result.videoId).toBe('k2h8PvLY6D4');
  });

  it('separates multiple punctuated sentences inside one cue', async () => {
    supadataTranscriptService.fetchTranscript.mockResolvedValue({
      language: 'en',
      cues: [
        {
          text: 'Listen carefully. Now repeat after me!',
          offset: 0,
          duration: 4000,
        },
      ],
    });
    mockTitle();

    const result = await service.prepare({
      url: 'https://youtu.be/k2h8PvLY6D4',
    });
    expect(result.sentences.map(({ text }) => text)).toEqual([
      'Listen carefully.',
      'Now repeat after me!',
    ]);
    expect(result.sentences[0].endSeconds).toBe(
      result.sentences[1].startSeconds,
    );
  });

  it('keeps estimated timestamps monotonic for overlapping cues', async () => {
    supadataTranscriptService.fetchTranscript.mockResolvedValue({
      language: 'en',
      cues: [
        {
          text: 'This earlier caption contains enough words to require splitting',
          offset: 0,
          duration: 6000,
        },
        { text: 'Next caption.', offset: 3000, duration: 2000 },
      ],
    });
    mockTitle();

    const result = await service.prepare({
      url: 'https://youtu.be/k2h8PvLY6D4',
      maxWordsPerSentence: 5,
    });
    expect(
      result.sentences.every(
        (sentence, index, all) =>
          index === 0 || sentence.startSeconds >= all[index - 1].startSeconds,
      ),
    ).toBe(true);
    expect(
      result.sentences.every(
        (sentence) => sentence.endSeconds >= sentence.startSeconds,
      ),
    ).toBe(true);
  });

  it('returns bad gateway when title retrieval fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    await expect(
      service.prepare({ url: 'https://youtu.be/k2h8PvLY6D4' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
