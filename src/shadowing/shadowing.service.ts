import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrepareShadowingDto } from './dto/prepare-shadowing.dto';
import {
  SupadataTranscriptCue,
  SupadataTranscriptService,
} from './supadata-transcript.service';

export interface ShadowingSentence {
  id: number;
  text: string;
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

interface YoutubeOEmbedResponse {
  title?: string;
}

interface TimedWords {
  text: string;
  startMs: number;
  endMs: number;
}

interface ResolvedTranscript {
  transcript: SupadataTranscriptCue[];
  language: string;
}

@Injectable()
export class ShadowingService {
  constructor(
    private readonly supadataTranscriptService: SupadataTranscriptService,
  ) {}

  async prepare(dto: PrepareShadowingDto): Promise<ShadowingResponse> {
    const videoId = this.extractYoutubeVideoId(dto.url);
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const language = dto.language?.trim() || 'en';

    const [resolvedTranscript, title] = await Promise.all([
      this.fetchVideoTranscript(canonicalUrl, language),
      this.fetchTitle(canonicalUrl),
    ]);
    const { transcript } = resolvedTranscript;

    if (transcript.length === 0) {
      throw new NotFoundException(
        `No ${language} transcript is available for this video`,
      );
    }

    const sentences = this.buildSentences(
      transcript,
      dto.maxWordsPerSentence ?? 12,
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

  private async fetchTitle(videoUrl: string): Promise<string> {
    const url = new URL('https://www.youtube.com/oembed');
    url.searchParams.set('url', videoUrl);
    url.searchParams.set('format', 'json');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as YoutubeOEmbedResponse;
      if (!data.title?.trim()) throw new Error('Empty title');
      return data.title.trim();
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

  private buildSentences(
    transcript: SupadataTranscriptCue[],
    maxWords: number,
  ): ShadowingSentence[] {
    const cues = transcript.flatMap((cue) => this.splitCue(cue));
    const chunks: TimedWords[] = [];
    let current: TimedWords | undefined;

    for (const cue of cues) {
      current = current
        ? { ...current, text: `${current.text} ${cue.text}`, endMs: cue.endMs }
        : { ...cue };

      const wordCount = current.text.split(/\s+/).length;
      if (/[.!?]["')\]]?$/.test(current.text) || wordCount >= maxWords) {
        chunks.push(current);
        current = undefined;
      }
    }
    if (current) chunks.push(current);

    let previousStartMs = 0;
    return chunks
      .flatMap((chunk) => this.splitLongChunk(chunk, maxWords))
      .map((chunk, index) => {
        // YouTube cues commonly overlap. A long earlier cue can otherwise
        // produce a later split whose estimated start precedes the next cue.
        const startMs = Math.max(chunk.startMs, previousStartMs, 0);
        const endMs = Math.max(chunk.endMs, startMs);
        previousStartMs = startMs;
        const startSeconds = this.seconds(startMs);
        const endSeconds = this.seconds(endMs);
        return {
          id: index + 1,
          text: chunk.text,
          startSeconds,
          endSeconds,
          durationSeconds: this.seconds(endMs - startMs),
        };
      });
  }

  private splitCue(cue: SupadataTranscriptCue): TimedWords[] {
    const text = this.cleanText(cue.text);
    if (!text) return [];

    const parts = text
      .match(/[^.!?]+(?:[.!?]+["')\]]*)?|[.!?]+/g)
      ?.map((part) => part.trim())
      .filter(Boolean) ?? [text];
    if (parts.length === 1) {
      return [{ text, startMs: cue.offset, endMs: cue.offset + cue.duration }];
    }

    const totalWeight = parts.reduce(
      (total, part) => total + Math.max(part.split(/\s+/).length, 1),
      0,
    );
    let elapsedWeight = 0;
    return parts.map((part) => {
      const startRatio = elapsedWeight / totalWeight;
      elapsedWeight += Math.max(part.split(/\s+/).length, 1);
      const endRatio = elapsedWeight / totalWeight;
      return {
        text: part,
        startMs: cue.offset + cue.duration * startRatio,
        endMs: cue.offset + cue.duration * endRatio,
      };
    });
  }

  private splitLongChunk(chunk: TimedWords, maxWords: number): TimedWords[] {
    const words = chunk.text.split(/\s+/);
    if (words.length <= maxWords) return [chunk];

    const result: TimedWords[] = [];
    const duration = chunk.endMs - chunk.startMs;
    for (let start = 0; start < words.length; start += maxWords) {
      const part = words.slice(start, start + maxWords);
      const startRatio = start / words.length;
      const endRatio = Math.min(start + maxWords, words.length) / words.length;
      result.push({
        text: part.join(' '),
        startMs: chunk.startMs + duration * startRatio,
        endMs: chunk.startMs + duration * endRatio,
      });
    }
    return result;
  }

  private cleanText(value: string): string {
    return value
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private seconds(milliseconds: number): number {
    return Math.round((milliseconds / 1000) * 1000) / 1000;
  }
}
