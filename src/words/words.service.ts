import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FlashcardAudioService } from '../flashcards/flashcard-audio.service';
import {
  FlashcardImageService,
  FlashcardImageSuggestion,
} from '../flashcards/flashcard-image.service';
import { TranslateService } from '../translate/translate.service';
import { AutocompleteWordDto } from './dto/autocomplete-word.dto';
import { CorrectTextDto } from './dto/correct-text.dto';
import { SuggestWordDto } from './dto/suggest-word.dto';
import { WordsExampleService } from './words-example.service';

interface DictionaryResponseItem {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{
      definition?: string;
      example?: string;
    }>;
  }>;
}

interface DatamuseSuggestion {
  word?: string;
  score?: number;
}

interface LanguageToolMatch {
  message?: string;
  offset?: number;
  length?: number;
  replacements?: Array<{
    value?: string;
  }>;
  rule?: {
    id?: string;
    description?: string;
    issueType?: string;
  };
}

interface LanguageToolResponse {
  matches?: LanguageToolMatch[];
}

export interface DefinitionSuggestion {
  text: string;
  partOfSpeech?: string;
}

export interface ExampleSuggestion {
  text: string;
  translation?: string;
  meaning?: string;
  partOfSpeech?: string;
  source?: 'openai' | 'dictionary';
}

export interface AudioSuggestion {
  url: string;
  source: 'polly' | 'dictionary';
}

export interface WordSuggestionResponse {
  word: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definitions: DefinitionSuggestion[];
  translation?: string;
  examples: ExampleSuggestion[];
  audio?: AudioSuggestion;
  images: FlashcardImageSuggestion[];
  sources: {
    dictionary?: string;
    translation?: string;
    audio?: string;
    examples?: string;
    images: Array<'pexels' | 'unsplash' | 'default'>;
  };
}

export interface WordAutocompleteResponse {
  query: string;
  suggestions: Array<{
    word: string;
    score: number;
  }>;
  source: 'datamuse';
}

export interface TextCorrectionResponse {
  original: string;
  corrected: string;
  language: string;
  suggestions: Array<{
    offset: number;
    length: number;
    original: string;
    replacements: string[];
    message?: string;
    ruleId?: string;
    issueType?: string;
  }>;
  source: 'languagetool';
}

@Injectable()
export class WordsService {
  private readonly logger = new Logger(WordsService.name);

  constructor(
    private readonly flashcardAudioService: FlashcardAudioService,
    private readonly flashcardImageService: FlashcardImageService,
    private readonly translateService: TranslateService,
    private readonly wordsExampleService: WordsExampleService,
  ) {}

  async autocompleteWords(
    dto: AutocompleteWordDto,
  ): Promise<WordAutocompleteResponse> {
    const query = dto.q.trim();
    if (!query) {
      throw new BadRequestException('Query must not be empty');
    }

    const limit = dto.limit || 8;

    try {
      const url = new URL('https://api.datamuse.com/sug');
      url.searchParams.set('s', query);
      url.searchParams.set('max', String(limit));

      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Datamuse autocomplete failed: ${response.status}`);
        return {
          query,
          suggestions: [],
          source: 'datamuse',
        };
      }

      const data = (await response.json()) as unknown;
      const suggestions = Array.isArray(data)
        ? (data as DatamuseSuggestion[])
            .filter((item) => item.word)
            .map((item) => ({
              word: String(item.word),
              score: Number(item.score || 0),
            }))
        : [];

      return {
        query,
        suggestions,
        source: 'datamuse',
      };
    } catch (error) {
      this.logger.warn(
        `Datamuse autocomplete failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return {
        query,
        suggestions: [],
        source: 'datamuse',
      };
    }
  }

  async correctText(dto: CorrectTextDto): Promise<TextCorrectionResponse> {
    const original = dto.text.trim();
    if (!original) {
      throw new BadRequestException('Text must not be empty');
    }

    const language = dto.language || 'en-US';

    try {
      const body = new URLSearchParams();
      body.set('text', original);
      body.set('language', language);

      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!response.ok) {
        this.logger.warn(`LanguageTool correction failed: ${response.status}`);
        return this.emptyCorrection(original, language);
      }

      const data = (await response.json()) as LanguageToolResponse;
      const suggestions = (data.matches || [])
        .filter(
          (match) => match.offset !== undefined && match.length !== undefined,
        )
        .map((match) => {
          const offset = Number(match.offset);
          const length = Number(match.length);
          return {
            offset,
            length,
            original: original.slice(offset, offset + length),
            replacements: (match.replacements || [])
              .map((replacement) => replacement.value)
              .filter((value): value is string => !!value)
              .slice(0, 5),
            message: match.message,
            ruleId: match.rule?.id,
            issueType: match.rule?.issueType,
          };
        });

      return {
        original,
        corrected: this.applyCorrections(original, suggestions),
        language,
        suggestions,
        source: 'languagetool',
      };
    } catch (error) {
      this.logger.warn(
        `LanguageTool correction failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return this.emptyCorrection(original, language);
    }
  }

  async suggestWord(
    userId: string,
    dto: SuggestWordDto,
  ): Promise<WordSuggestionResponse> {
    const word = dto.word.trim();
    if (!word) {
      throw new BadRequestException('Word must not be empty');
    }

    const targetLanguage = dto.targetLanguage || 'vi';
    const imageLimit = dto.imageLimit || 3;

    const dictionaryItems = await this.fetchDictionary(word);
    const definitions = this.extractDefinitions(dictionaryItems);
    const dictionaryExamples = this.extractExamples(dictionaryItems);
    const pronunciation = this.extractPronunciation(dictionaryItems);
    const dictionaryAudioUrl = this.extractDictionaryAudioUrl(dictionaryItems);
    const examples =
      (await this.wordsExampleService.generateExamples(word, definitions)) ||
      [];
    const finalExamples =
      examples.length > 0 ? examples : dictionaryExamples.slice(0, 4);

    const [translation, translatedExamples, audioUrl, images] =
      await Promise.all([
        this.translateSafely(word, targetLanguage),
        this.translateExamples(finalExamples, targetLanguage),
        this.flashcardAudioService.createAudioUrl(userId, word),
        this.flashcardImageService.findImageUrls(word, imageLimit),
      ]);

    return {
      word,
      pronunciation,
      partOfSpeech: definitions[0]?.partOfSpeech,
      definitions,
      translation,
      examples: finalExamples.map((example, index) => ({
        text: example.text,
        meaning: example.meaning,
        partOfSpeech: example.partOfSpeech,
        source: example.source,
        translation: translatedExamples[index],
      })),
      audio: this.buildAudioSuggestion(audioUrl, dictionaryAudioUrl),
      images,
      sources: this.buildSources(
        dictionaryItems,
        images,
        translation,
        audioUrl,
        dictionaryAudioUrl,
        finalExamples[0]?.source,
      ),
    };
  }

  private async fetchDictionary(
    word: string,
  ): Promise<DictionaryResponseItem[]> {
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
          word,
        )}`,
      );

      if (!response.ok) {
        this.logger.warn(`Dictionary lookup failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as unknown;
      return Array.isArray(data) ? (data as DictionaryResponseItem[]) : [];
    } catch (error) {
      this.logger.warn(
        `Dictionary lookup failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return [];
    }
  }

  private emptyCorrection(
    original: string,
    language: string,
  ): TextCorrectionResponse {
    return {
      original,
      corrected: original,
      language,
      suggestions: [],
      source: 'languagetool',
    };
  }

  private applyCorrections(
    original: string,
    suggestions: TextCorrectionResponse['suggestions'],
  ): string {
    return [...suggestions]
      .filter((suggestion) => suggestion.replacements.length > 0)
      .sort((a, b) => b.offset - a.offset)
      .reduce((corrected, suggestion) => {
        const replacement = suggestion.replacements[0];
        return (
          corrected.slice(0, suggestion.offset) +
          replacement +
          corrected.slice(suggestion.offset + suggestion.length)
        );
      }, original);
  }

  private extractDefinitions(
    items: DictionaryResponseItem[],
  ): DefinitionSuggestion[] {
    return items
      .flatMap((item) => item.meanings || [])
      .flatMap((meaning) =>
        (meaning.definitions || []).reduce<DefinitionSuggestion[]>(
          (definitions, definition) => {
            if (definition.definition) {
              definitions.push({
                text: definition.definition,
                partOfSpeech: meaning.partOfSpeech,
              });
            }
            return definitions;
          },
          [],
        ),
      )
      .slice(0, 5);
  }

  private extractExamples(
    items: DictionaryResponseItem[],
  ): ExampleSuggestion[] {
    const examples = items
      .flatMap((item) => item.meanings || [])
      .flatMap((meaning) => meaning.definitions || [])
      .map((definition) => definition.example)
      .filter((example): example is string => !!example)
      .slice(0, 3);

    return examples.map((example) => ({
      text: example,
      source: 'dictionary',
    }));
  }

  private extractPronunciation(
    items: DictionaryResponseItem[],
  ): string | undefined {
    for (const item of items) {
      const phonetic =
        item.phonetic || item.phonetics?.find((p) => p.text)?.text;
      if (phonetic) return phonetic;
    }
    return undefined;
  }

  private extractDictionaryAudioUrl(
    items: DictionaryResponseItem[],
  ): string | undefined {
    for (const item of items) {
      const audio = item.phonetics?.find((phonetic) => phonetic.audio)?.audio;
      if (audio) return audio;
    }
    return undefined;
  }

  private async translateExamples(
    examples: ExampleSuggestion[],
    targetLanguage: string,
  ): Promise<Array<string | undefined>> {
    return Promise.all(
      examples.map((example) =>
        this.translateSafely(example.text, targetLanguage),
      ),
    );
  }

  private async translateSafely(
    text: string,
    targetLanguage: string,
  ): Promise<string | undefined> {
    try {
      const result = await this.translateService.translateText({
        text,
        sourceLanguage: 'en',
        targetLanguage,
      });
      return result.translatedText || undefined;
    } catch (error) {
      this.logger.warn(
        `Translation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return undefined;
    }
  }

  private buildAudioSuggestion(
    pollyAudioUrl?: string,
    dictionaryAudioUrl?: string,
  ): AudioSuggestion | undefined {
    if (pollyAudioUrl) {
      return {
        url: pollyAudioUrl,
        source: 'polly',
      };
    }

    if (dictionaryAudioUrl) {
      return {
        url: dictionaryAudioUrl,
        source: 'dictionary',
      };
    }

    return undefined;
  }

  private buildSources(
    dictionaryItems: DictionaryResponseItem[],
    images: FlashcardImageSuggestion[],
    translation?: string,
    pollyAudioUrl?: string,
    dictionaryAudioUrl?: string,
    exampleSource?: 'openai' | 'dictionary',
  ) {
    return {
      dictionary: dictionaryItems.length > 0 ? 'dictionaryapi.dev' : undefined,
      translation: translation ? 'aws-translate' : undefined,
      audio: pollyAudioUrl
        ? 'aws-polly'
        : dictionaryAudioUrl
          ? 'dictionaryapi.dev'
          : undefined,
      examples:
        exampleSource === 'openai'
          ? 'openai'
          : exampleSource === 'dictionary'
            ? 'dictionaryapi.dev'
            : undefined,
      images: [...new Set(images.map((image) => image.source))],
    };
  }
}
