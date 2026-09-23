import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ShadowingService } from './shadowing.service';

describe('ShadowingService', () => {
  const supadataTranscriptService = { fetchTranscript: jest.fn() };
  const videoMetadataRepository = {
    findOne: jest.fn(),
    upsert: jest.fn(),
  };
  const recentVideoRepository = {
    find: jest.fn(),
    upsert: jest.fn(),
  };
  const service = new ShadowingService(
    supadataTranscriptService as never,
    videoMetadataRepository as never,
    recentVideoRepository as never,
  );

  beforeEach(() => {
    supadataTranscriptService.fetchTranscript.mockReset();
    videoMetadataRepository.findOne.mockReset();
    videoMetadataRepository.upsert.mockReset();
    recentVideoRepository.find.mockReset();
    recentVideoRepository.upsert.mockReset();
    supadataTranscriptService.fetchTranscript.mockResolvedValue({
      language: 'en',
      cues: [{ text: 'Hello.', offset: 0, duration: 500, lang: 'en' }],
    });
    videoMetadataRepository.findOne.mockResolvedValue(null);
    videoMetadataRepository.upsert.mockResolvedValue(undefined);
    recentVideoRepository.find.mockResolvedValue([]);
    recentVideoRepository.upsert.mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const mockTitle = (title = 'Video title') =>
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title }),
    } as Response);

  it('returns Supadata cues unchanged with the video metadata', async () => {
    supadataTranscriptService.fetchTranscript.mockResolvedValue({
      language: 'en',
      cues: [
        {
          text: 'This is a short sentence.',
          offset: 0,
          duration: 2000,
          lang: 'en',
        },
        {
          text: 'This caption has more words than we want in one shadowing sentence',
          offset: 2000,
          duration: 4000,
        },
      ],
    });
    mockTitle('A useful English lesson');

    const result = await service.prepare('user-1', {
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
    expect(videoMetadataRepository.upsert).toHaveBeenCalledWith(
      { videoId: 'k2h8PvLY6D4', title: 'A useful English lesson' },
      ['videoId'],
    );
    expect(recentVideoRepository.upsert).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        videoId: 'k2h8PvLY6D4',
        url: 'https://www.youtube.com/watch?v=k2h8PvLY6D4',
        title: 'A useful English lesson',
        language: 'en',
      },
      ['userId', 'videoId'],
    );
    expect(result.sentences).toEqual([
      {
        id: 1,
        text: 'This is a short sentence.',
        offset: 0,
        duration: 2000,
        lang: 'en',
        startSeconds: 0,
        endSeconds: 2,
        durationSeconds: 2,
      },
      {
        id: 2,
        text: 'This caption has more words than we want in one shadowing sentence',
        offset: 2000,
        duration: 4000,
        startSeconds: 2,
        endSeconds: 6,
        durationSeconds: 4,
      },
    ]);
  });

  it('uses a cached video title instead of calling YouTube oEmbed again', async () => {
    videoMetadataRepository.findOne.mockResolvedValue({
      videoId: 'k2h8PvLY6D4',
      title: 'Cached lesson title',
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await service.prepare('user-1', {
      url: 'https://youtu.be/k2h8PvLY6D4',
    });

    expect(result.title).toBe('Cached lesson title');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(videoMetadataRepository.upsert).not.toHaveBeenCalled();
  });

  it('rejects non-YouTube links before calling Supadata', async () => {
    await expect(
      service.prepare('user-1', { url: 'https://example.com/video' }),
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
    const result = await service.prepare('user-1', { url });
    expect(result.videoId).toBe('k2h8PvLY6D4');
  });

  it('does not split, merge, deduplicate, or normalize Supadata cues', async () => {
    supadataTranscriptService.fetchTranscript.mockResolvedValue({
      language: 'en',
      cues: [
        {
          text: 'Listen carefully. Now repeat after me!',
          offset: 0,
          duration: 4000,
        },
        {
          text: 'Same caption.',
          offset: 2000,
          duration: 3000,
        },
        {
          text: '>> Same caption.',
          offset: 2000,
          duration: 3000,
        },
      ],
    });
    mockTitle();

    const result = await service.prepare('user-1', {
      url: 'https://youtu.be/k2h8PvLY6D4',
    });
    expect(result.sentences).toEqual([
      {
        id: 1,
        text: 'Listen carefully. Now repeat after me!',
        offset: 0,
        duration: 4000,
        startSeconds: 0,
        endSeconds: 4,
        durationSeconds: 4,
      },
      {
        id: 2,
        text: 'Same caption.',
        offset: 2000,
        duration: 3000,
        startSeconds: 2,
        endSeconds: 5,
        durationSeconds: 3,
      },
      {
        id: 3,
        text: '>> Same caption.',
        offset: 2000,
        duration: 3000,
        startSeconds: 2,
        endSeconds: 5,
        durationSeconds: 3,
      },
    ]);
  });

  it('returns bad gateway when title retrieval fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    await expect(
      service.prepare('user-1', {
        url: 'https://youtu.be/k2h8PvLY6D4',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(recentVideoRepository.upsert).not.toHaveBeenCalled();
  });

  it('returns only the current user recent videos in most-recent order', async () => {
    const lastOpenedAt = new Date('2026-09-23T10:00:00.000Z');
    recentVideoRepository.find.mockResolvedValue([
      {
        videoId: 'k2h8PvLY6D4',
        url: 'https://www.youtube.com/watch?v=k2h8PvLY6D4',
        title: 'Recent lesson',
        language: 'en',
        updatedAt: lastOpenedAt,
      },
    ]);

    await expect(service.getRecent('user-1', 5)).resolves.toEqual([
      {
        videoId: 'k2h8PvLY6D4',
        url: 'https://www.youtube.com/watch?v=k2h8PvLY6D4',
        title: 'Recent lesson',
        language: 'en',
        lastOpenedAt,
      },
    ]);
    expect(recentVideoRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { updatedAt: 'DESC' },
      take: 5,
    });
  });
});
