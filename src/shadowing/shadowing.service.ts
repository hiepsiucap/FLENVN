import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrepareShadowingDto } from './dto/prepare-shadowing.dto';
import { ShadowingVideoMetadata } from './shadowing-video-metadata.entity';
import { ShadowingRecentVideo } from './shadowing-recent-video.entity';
import {
  SupadataTranscriptCue,
  SupadataTranscriptService,
} from './supadata-transcript.service';

export interface ShadowingSentence {
  id: number;
  text: string;
  offset: number;
  duration: number;
  lang?: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
}

export interface ShadowingResponse {
  videoId: string;
  url: string;
  title: string;
  language: string;
  sentenceCount: number;
  sentences: ShadowingSentence[];
  transcriptSource: 'supadata';
}

export interface RecentShadowingVideoResponse {
  videoId: string;
  url: string;
  title: string;
  language: string;
  lastOpenedAt: Date;
}

interface YoutubeOEmbedResponse {
  title?: string;
}

interface ResolvedTranscript {
  transcript: SupadataTranscriptCue[];
  language: string;
}

@Injectable()
export class ShadowingService {
  constructor(
    private readonly supadataTranscriptService: SupadataTranscriptService,
    @InjectRepository(ShadowingVideoMetadata)
    private readonly videoMetadataRepository: Repository<ShadowingVideoMetadata>,
    @InjectRepository(ShadowingRecentVideo)
    private readonly recentVideoRepository: Repository<ShadowingRecentVideo>,
  ) {}

  async prepare(
    userId: string,
    dto: PrepareShadowingDto,
  ): Promise<ShadowingResponse> {
    const videoId = this.extractYoutubeVideoId(dto.url);
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const language = dto.language?.trim() || 'en';

    const [resolvedTranscript, title] = await Promise.all([
      this.fetchVideoTranscript(canonicalUrl, language),
      this.fetchTitle(videoId, canonicalUrl),
    ]);
    const { transcript } = resolvedTranscript;

    if (transcript.length === 0) {
      throw new NotFoundException(
        `No ${language} transcript is available for this video`,
      );
    }

    const sentences = transcript.map((cue, index) => ({
      id: index + 1,
      text: cue.text,
      offset: cue.offset,
      duration: cue.duration,
      ...(cue.lang ? { lang: cue.lang } : {}),
      startSeconds: this.seconds(cue.offset),
      endSeconds: this.seconds(cue.offset + cue.duration),
      durationSeconds: this.seconds(cue.duration),
    }));

    await this.recentVideoRepository.upsert(
      {
        userId,
        videoId,
        url: canonicalUrl,
        title,
        language: resolvedTranscript.language,
      },
      ['userId', 'videoId'],
    );

    return {
      videoId,
      url: canonicalUrl,
      title,
      language: resolvedTranscript.language,
      sentenceCount: sentences.length,
      sentences,
      transcriptSource: 'supadata',
    };
  }

  async getRecent(
    userId: string,
    limit = 10,
  ): Promise<RecentShadowingVideoResponse[]> {
    const videos = await this.recentVideoRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: limit,
    });

    return videos.map((video) => ({
      videoId: video.videoId,
      url: video.url,
      title: video.title,
      language: video.language,
      lastOpenedAt: video.updatedAt,
    }));
  }

  private extractYoutubeVideoId(value: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('A valid YouTube URL is required');
    }

    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId: string | null = null;
    if (hostname === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'music.youtube.com'
    ) {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v');
      else {
        const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/);
        videoId = match?.[1] ?? null;
      }
    }

    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      throw new BadRequestException('A valid YouTube video URL is required');
    }
    return videoId;
  }

  private async fetchTitle(videoId: string, videoUrl: string): Promise<string> {
    const cached = await this.videoMetadataRepository.findOne({
      where: { videoId },
    });
    if (cached?.title.trim()) return cached.title.trim();

    const url = new URL('https://www.youtube.com/oembed');
    url.searchParams.set('url', videoUrl);
    url.searchParams.set('format', 'json');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as YoutubeOEmbedResponse;
      if (!data.title?.trim()) throw new Error('Empty title');
      const title = data.title.trim();
      await this.videoMetadataRepository.upsert({ videoId, title }, [
        'videoId',
      ]);
      return title;
    } catch {
      throw new BadGatewayException('Could not load the YouTube video title');
    }
  }

  private async fetchVideoTranscript(
    videoUrl: string,
    language: string,
  ): Promise<ResolvedTranscript> {
    const result = await this.supadataTranscriptService.fetchTranscript(
      videoUrl,
      language,
    );
    return { transcript: result.cues, language: result.language };
  }

  private seconds(milliseconds: number): number {
    return Math.round((milliseconds / 1000) * 1000) / 1000;
  }
}
