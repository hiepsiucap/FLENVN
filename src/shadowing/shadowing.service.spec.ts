import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  fetchTranscript,
  YoutubeTranscriptNotAvailableLanguageError,
} from 'youtube-transcript';
import { ShadowingService } from './shadowing.service';

jest.mock('youtube-transcript', () => ({
  fetchTranscript: jest.fn(),
  YoutubeTranscriptDisabledError: class extends Error {},
  YoutubeTranscriptNotAvailableError: class extends Error {},
  YoutubeTranscriptNotAvailableLanguageError: class extends Error {},
  YoutubeTranscriptVideoUnavailableError: class extends Error {},
}));

const mockedFetchTranscript = fetchTranscript as jest.MockedFunction<
  typeof fetchTranscript
>;

describe('ShadowingService', () => {
  const service = new ShadowingService();

  afterEach(() => {
    jest.restoreAllMocks();
    mockedFetchTranscript.mockReset();
  });

  it('returns the title and short timestamped sentences', async () => {
    mockedFetchTranscript.mockResolvedValue([
      { text: 'This is a short sentence.', offset: 0, duration: 2000 },
      {
        text: 'This caption has more words than we want in one shadowing sentence',
        offset: 2000,
        duration: 4000,
      },
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'A useful English lesson' }),
    } as Response);

    const result = await service.prepare({
      url: 'https://youtu.be/k2h8PvLY6D4',
      language: 'en',
      maxWordsPerSentence: 5,
    });

    expect(result.title).toBe('A useful English lesson');
    expect(result.videoId).toBe('k2h8PvLY6D4');
    expect(
      result.sentences.every((item) => item.text.split(/\s+/).length <= 5),
    ).toBe(true);
    expect(result.sentences[0]).toEqual({
      id: 1,
      text: 'This is a short sentence.',
      startSeconds: 0,
      endSeconds: 2,
      durationSeconds: 2,
    });
  });

  it('rejects links that are not YouTube videos', async () => {
    await expect(
      service.prepare({ url: 'https://example.com/video' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockedFetchTranscript).not.toHaveBeenCalled();
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
    mockedFetchTranscript.mockResolvedValue([
      { text: 'Hello.', offset: 0, duration: 500 },
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Video title' }),
    } as Response);

    const result = await service.prepare({ url });

    expect(result.videoId).toBe('k2h8PvLY6D4');
  });

  it('separates multiple punctuated sentences inside one caption cue', async () => {
    mockedFetchTranscript.mockResolvedValue([
      {
        text: 'Listen carefully. Now repeat after me!',
        offset: 0,
        duration: 4000,
      },
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Video title' }),
    } as Response);

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

  it('keeps estimated starts monotonic when YouTube caption cues overlap', async () => {
    mockedFetchTranscript.mockResolvedValue([
      {
        text: 'This earlier caption contains enough words to require splitting',
        offset: 0,
        duration: 6000,
      },
      { text: 'Next caption.', offset: 3000, duration: 2000 },
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Video title' }),
    } as Response);

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

  it('returns not found when the requested transcript language is absent', async () => {
    mockedFetchTranscript.mockRejectedValue(
      new YoutubeTranscriptNotAvailableLanguageError(
        'vi',
        ['en'],
        'k2h8PvLY6D4',
      ),
    );
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Video title' }),
    } as Response);

    await expect(
      service.prepare({ url: 'https://youtu.be/k2h8PvLY6D4', language: 'vi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns bad gateway when title retrieval fails', async () => {
    mockedFetchTranscript.mockResolvedValue([
      { text: 'Hello.', offset: 0, duration: 500 },
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);

    await expect(
      service.prepare({ url: 'https://youtu.be/k2h8PvLY6D4' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
