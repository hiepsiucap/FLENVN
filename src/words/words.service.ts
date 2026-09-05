import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlashcardAudioService } from '../flashcards/flashcard-audio.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { FlashCard } from '../flashcards/flashcard.entity';
import {
  FlashcardImageService,
  FlashcardImageSuggestion,
} from '../flashcards/flashcard-image.service';
import { TranslateService } from '../translate/translate.service';
import { AutocompleteWordDto } from './dto/autocomplete-word.dto';
import { CorrectTextDto } from './dto/correct-text.dto';
import { ExplainWordInContextDto } from './dto/explain-word-in-context.dto';
import { SuggestWordDto } from './dto/suggest-word.dto';
import {
  SuggestTopicVocabularyDto,
  TopicVocabularyLevel,
} from './dto/suggest-topic-vocabulary.dto';
import {
  OpenAiWordSuggestion,
  WordsExampleService,
} from './words-example.service';

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
  tags?: string[];
}

interface DatamusePronunciationResult {
  word?: string;
  tags?: string[];
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

interface OpenAiTopicVocabularyItem {
  word?: string;
  partOfSpeech?: string;
  definition?: string;
  translation?: string;
  example?: string;
  exampleTranslation?: string;
  difficulty?: TopicVocabularyLevel;
}

interface OpenAiTopicVocabularyResponse {
  suggestions?: OpenAiTopicVocabularyItem[];
}

interface OpenAiResponse {
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
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
  source?: 'vertex' | 'openai' | 'dictionary' | 'database';
}

export interface AudioSuggestion {
  url: string;
  source: 'polly' | 'dictionary';
}

export interface WordSuggestionResponse {
  existing?: boolean;
  existingFlashcardId?: string;
  source?: 'generated' | 'database';
  word: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definitions: DefinitionSuggestion[];
  translation?: string;
  examples: ExampleSuggestion[];
  suggestions: WordLearningCombo[];
  audio?: AudioSuggestion;
  images: FlashcardImageSuggestion[];
  sources: {
    dictionary?: string;
    translation?: string;
    audio?: string;
    examples?: string;
    images: Array<'pexels' | 'unsplash' | 'default' | 'database'>;
  };
}

export interface ContextualWordExplanationResponse {
  existing?: boolean;
  existingFlashcardId?: string;
  word: string;
  matchedForm: string;
  contextSentence: string;
  pronunciation?: string;
  partOfSpeech: string;
  definition: string;
  translation: string;
  explanation: string;
  example: string;
  generatedExample: boolean;
  exampleTranslation: string;
  audio?: AudioSuggestion;
  images: FlashcardImageSuggestion[];
  source: 'generated' | 'database';
}

export interface WordLearningCombo {
  definition: DefinitionSuggestion;
  translation?: string;
  example?: ExampleSuggestion;
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

export interface TopicVocabularySuggestion {
  word: string;
  partOfSpeech?: string;
  definition?: string;
  translation?: string;
  example?: string;
  exampleTranslation?: string;
  difficulty?: TopicVocabularyLevel;
}

export interface TopicVocabularySuggestionResponse {
  topic: string;
  level: TopicVocabularyLevel;
  targetLanguage: string;
  suggestions: TopicVocabularySuggestion[];
  source: 'openai' | 'datamuse';
}

@Injectable()
export class WordsService {
  private readonly logger = new Logger(WordsService.name);
  private readonly dictionaryApiTimeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly flashcardAudioService: FlashcardAudioService,
    private readonly flashcardImageService: FlashcardImageService,
    private readonly translateService: TranslateService,
    private readonly wordsExampleService: WordsExampleService,
    private readonly flashcardsService: FlashcardsService,
  ) {
    this.dictionaryApiTimeoutMs = this.configService.get<number>(
      'DICTIONARY_API_TIMEOUT_MS',
      3000,
    );
  }

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

  async suggestTopicVocabulary(
    dto: SuggestTopicVocabularyDto,
  ): Promise<TopicVocabularySuggestionResponse> {
    const topic = dto.topic.trim();
    if (!topic) {
      throw new BadRequestException('Topic must not be empty');
    }

    const level = dto.level || TopicVocabularyLevel.BEGINNER;
    const limit = dto.limit || 20;
    const targetLanguage = dto.targetLanguage || 'vi';

    const openAiSuggestions = await this.generateTopicVocabularyWithOpenAi(
      topic,
      level,
      limit,
      targetLanguage,
    );

    if (openAiSuggestions.length > 0) {
      return {
        topic,
        level,
        targetLanguage,
        suggestions: openAiSuggestions,
        source: 'openai',
      };
    }

    return {
      topic,
      level,
      targetLanguage,
      suggestions: await this.generateTopicVocabularyWithDatamuse(
        topic,
        level,
        limit,
        targetLanguage,
      ),
      source: 'datamuse',
    };
  }

  async suggestWord(
    userId: string,
    dto: SuggestWordDto,
  ): Promise<WordSuggestionResponse> {
    const word = dto.word.trim();
    if (!word) {
      throw new BadRequestException('Word must not be empty');
    }
    const existingFlashcard = await this.flashcardsService.findByWord(
      userId,
      word,
    );
    if (existingFlashcard) {
      return this.buildExistingSuggestion(existingFlashcard);
    }

    const targetLanguage = dto.targetLanguage || 'vi';
    const imageLimit = dto.imageLimit || 3;

    // Every upstream call depends only on the request and starts in parallel.
    const pronunciationPromise = this.fetchPronunciation(word);
    const openAiSuggestionsPromise =
      this.wordsExampleService.generateSuggestions(word, targetLanguage);
    const translationPromise = this.translateSafely(word, targetLanguage);
    const audioUrlPromise = this.flashcardAudioService.createAudioUrl(
      userId,
      word,
    );
    const imagesPromise = this.flashcardImageService.findImageUrls(
      word,
      imageLimit,
    );

    const [pronunciation, openAiSuggestions, translation, audioUrl, images] =
      await Promise.all([
        pronunciationPromise,
        openAiSuggestionsPromise,
        translationPromise,
        audioUrlPromise,
        imagesPromise,
      ]);

    const definitions = openAiSuggestions.map((suggestion) => ({
      text: suggestion.definition,
      partOfSpeech: suggestion.partOfSpeech,
    }));
    const examples = openAiSuggestions.map((suggestion) =>
      this.buildAiExample(suggestion),
    );
    const suggestions = openAiSuggestions.map((suggestion, index) => ({
      definition: definitions[index],
      translation: suggestion.translation,
      example: examples[index],
    }));

    return {
      word,
      pronunciation,
      partOfSpeech: definitions[0]?.partOfSpeech,
      definitions,
      translation,
      examples: examples.map((example) => ({
        text: example.text,
        meaning: example.meaning,
        partOfSpeech: example.partOfSpeech,
        source: example.source,
        translation: example.translation,
      })),
      suggestions,
      audio: this.buildAudioSuggestion(audioUrl),
      images,
      sources: this.buildSources(
        pronunciation,
        images,
        translation,
        audioUrl,
        examples[0]?.source,
      ),
      source: 'generated',
    };
  }

  async explainWordInContext(
    userId: string,
    dto: ExplainWordInContextDto,
  ): Promise<ContextualWordExplanationResponse> {
    const text = dto.text.trim();
    const word = dto.word.trim();
    if (!text) throw new BadRequestException('Text must not be empty');
    if (!word) throw new BadRequestException('Word must not be empty');

    const occurrence = this.findWordOccurrence(
      text,
      word,
      dto.occurrenceIndex ?? 0,
    );
    if (!occurrence) {
      throw new BadRequestException(
        'The requested word occurrence was not found in the supplied text',
      );
    }

    const existingFlashcard = await this.flashcardsService.findByWord(
      userId,
      word,
    );
    const example = this.extractContainingSentence(text, occurrence.index);
    if (existingFlashcard) {
      return this.buildExistingContextResponse(
        existingFlashcard,
        word,
        occurrence.matchedForm,
        example,
      );
    }

    const targetLanguage = dto.targetLanguage || 'vi';
    const [explanation, pronunciation, audioUrl, images] = await Promise.all([
      this.wordsExampleService.explainInContext(
        word,
        occurrence.matchedForm,
        text,
        example,
        targetLanguage,
      ),
      this.fetchPronunciation(word),
      this.flashcardAudioService.createAudioUrl(userId, word),
      this.flashcardImageService.findImageUrls(word, dto.imageLimit || 3),
    ]);

    if (!explanation) {
      throw new InternalServerErrorException(
        'Contextual word explanation is temporarily unavailable',
      );
    }

    return {
      word,
      matchedForm: occurrence.matchedForm,
      contextSentence: example,
      pronunciation,
      partOfSpeech: explanation.partOfSpeech,
      definition: explanation.definition,
      translation: explanation.translation,
      explanation: explanation.explanation,
      example: explanation.example,
      generatedExample: explanation.generatedExample,
      exampleTranslation: explanation.exampleTranslation,
      audio: this.buildAudioSuggestion(audioUrl),
      images,
      source: 'generated',
    };
  }

  private buildExistingSuggestion(
    flashcard: FlashCard,
  ): WordSuggestionResponse {
    const definition = flashcard.definition
      ? {
          text: flashcard.definition,
          partOfSpeech: flashcard.partOfSpeech || undefined,
        }
      : undefined;
    const example = flashcard.example
      ? {
          text: flashcard.example,
          translation: flashcard.exampleTranslation || undefined,
          meaning: flashcard.definition || undefined,
          partOfSpeech: flashcard.partOfSpeech || undefined,
          source: 'database' as const,
        }
      : undefined;
    const images: FlashcardImageSuggestion[] = flashcard.imageUrl
      ? [{ url: flashcard.imageUrl, source: 'default' }]
      : [];

    return {
      existing: true,
      existingFlashcardId: flashcard.id,
      source: 'database',
      word: flashcard.word,
      pronunciation: flashcard.pronunciation || undefined,
      partOfSpeech: flashcard.partOfSpeech || undefined,
      definitions: definition ? [definition] : [],
      translation: flashcard.translation || undefined,
      examples: example ? [example] : [],
      suggestions: definition
        ? [
            {
              definition,
              translation: flashcard.translation || undefined,
              example,
            },
          ]
        : [],
      audio: flashcard.audioUrl
        ? { url: flashcard.audioUrl, source: 'polly' }
        : undefined,
      images,
      sources: {
        dictionary: flashcard.pronunciation ? 'database' : undefined,
        translation: flashcard.translation ? 'database' : undefined,
        audio: flashcard.audioUrl ? 'database' : undefined,
        examples: flashcard.example ? 'database' : undefined,
        images: flashcard.imageUrl ? ['database'] : [],
      },
    };
  }

  private buildExistingContextResponse(
    flashcard: FlashCard,
    word: string,
    matchedForm: string,
    contextSentence: string,
  ): ContextualWordExplanationResponse {
    return {
      existing: true,
      existingFlashcardId: flashcard.id,
      word,
      matchedForm,
      contextSentence,
      pronunciation: flashcard.pronunciation || undefined,
      partOfSpeech: flashcard.partOfSpeech || '',
      definition: flashcard.definition || '',
      translation: flashcard.translation || '',
      explanation: '',
      example: flashcard.example || contextSentence,
      generatedExample: false,
      exampleTranslation: flashcard.exampleTranslation || '',
      audio: flashcard.audioUrl
        ? { url: flashcard.audioUrl, source: 'polly' }
        : undefined,
      images: flashcard.imageUrl
        ? [{ url: flashcard.imageUrl, source: 'default' }]
        : [],
      source: 'database',
    };
  }

  private findWordOccurrence(
    text: string,
    word: string,
    occurrenceIndex: number,
  ): { matchedForm: string; index: number } | undefined {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const forms = new Set([escaped]);
    const lower = word.toLowerCase();

    if (/^[a-z]+$/i.test(word)) {
      forms.add(`${escaped}s`);
      forms.add(`${escaped}es`);
      forms.add(`${escaped}ed`);
      forms.add(`${escaped}ing`);
      if (lower.endsWith('e')) {
        forms.add(`${escaped}d`);
        forms.add(`${escaped.slice(0, -1)}ing`);
      }
      if (lower.endsWith('y') && word.length > 1) {
        forms.add(`${escaped.slice(0, -1)}ies`);
        forms.add(`${escaped.slice(0, -1)}ied`);
      }
      const last = lower.at(-1);
      const previous = lower.at(-2);
      if (
        last &&
        previous &&
        /[bcdfgklmnprst]/.test(last) &&
        /[aeiou]/.test(previous)
      ) {
        forms.add(`${escaped}${last}ed`);
        forms.add(`${escaped}${last}ing`);
      }
    }

    const pattern = [...forms].sort((a, b) => b.length - a.length).join('|');
    const regex = new RegExp(`(?<![A-Za-z])(?:${pattern})(?![A-Za-z])`, 'giu');
    const matches = [...text.matchAll(regex)];
    const match = matches[occurrenceIndex];
    if (match?.index === undefined) return undefined;
    return { matchedForm: match[0], index: match.index };
  }

  private extractContainingSentence(text: string, matchIndex: number): string {
    const before = text.slice(0, matchIndex);
    const previousBoundary = Math.max(
      before.lastIndexOf('.'),
      before.lastIndexOf('!'),
      before.lastIndexOf('?'),
      before.lastIndexOf('\n'),
    );
    const after = text.slice(matchIndex);
    const nextRelative = after.search(/[.!?\n]/);
    const end =
      nextRelative === -1 ? text.length : matchIndex + nextRelative + 1;
    return text.slice(previousBoundary + 1, end).trim();
  }

  private buildAiExample(suggestion: OpenAiWordSuggestion): ExampleSuggestion {
    return {
      text: suggestion.example,
      translation: suggestion.exampleTranslation,
      meaning: suggestion.definition,
      partOfSpeech: suggestion.partOfSpeech,
      source: suggestion.source,
    };
  }

  private async fetchPronunciation(word: string): Promise<string | undefined> {
    try {
      const url = new URL('https://api.datamuse.com/words');
      url.searchParams.set('sp', word);
      url.searchParams.set('md', 'r');
      url.searchParams.set('ipa', '1');
      url.searchParams.set('max', '1');
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.dictionaryApiTimeoutMs),
      });

      if (!response.ok) {
        this.logger.warn(`Pronunciation lookup failed: ${response.status}`);
        return undefined;
      }

      const data = (await response.json()) as DatamusePronunciationResult[];
      const exactMatch = data.find(
        (result) => result.word?.toLowerCase() === word.toLowerCase(),
      );
      const pronunciation = exactMatch?.tags?.find((tag) =>
        tag.startsWith('ipa_pron:'),
      );
      return pronunciation?.slice('ipa_pron:'.length).trim() || undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        error instanceof DOMException && error.name === 'TimeoutError'
          ? `Pronunciation lookup timed out after ${this.dictionaryApiTimeoutMs}ms`
          : `Pronunciation lookup failed: ${message}`,
      );
      return undefined;
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

  private async generateTopicVocabularyWithOpenAi(
    topic: string,
    level: TopicVocabularyLevel,
    limit: number,
    targetLanguage: string,
  ): Promise<TopicVocabularySuggestion[]> {
    const apiKey = this.configService.get<string>('services.openai.apiKey');
    if (!apiKey) return [];

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          this.buildTopicVocabularyRequestBody(
            topic,
            level,
            limit,
            targetLanguage,
          ),
        ),
      });

      if (!response.ok) {
        this.logger.warn(
          `OpenAI topic vocabulary generation failed: ${response.status}`,
        );
        return [];
      }

      const data = (await response.json()) as OpenAiResponse;
      if (data.status === 'incomplete') {
        this.logger.warn(
          `OpenAI topic vocabulary generation incomplete: ${
            data.incomplete_details?.reason || 'unknown reason'
          }`,
        );
        return [];
      }

      const text = this.extractOpenAiOutputText(data);
      if (!text) return [];

      const parsed = JSON.parse(text) as OpenAiTopicVocabularyResponse;

      return this.normalizeTopicVocabularySuggestions(
        parsed.suggestions || [],
        level,
        limit,
      );
    } catch (error) {
      this.logger.warn(
        `OpenAI topic vocabulary generation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return [];
    }
  }

  private buildTopicVocabularyRequestBody(
    topic: string,
    level: TopicVocabularyLevel,
    limit: number,
    targetLanguage: string,
  ) {
    const maxOutputTokens = this.configService.get<number>(
      'services.openai.maxTokens',
      1000,
    );

    return {
      model: this.configService.get<string>(
        'services.openai.model',
        'gpt-5-nano',
      ),
      store: false,
      max_output_tokens: Math.max(maxOutputTokens, 3000),
      reasoning: {
        effort: 'minimal',
      },
      instructions:
        'You create broad, practical vocabulary sets for English learners. Return only valid JSON.',
      input: JSON.stringify({
        task: 'Generate a broad topic-based English vocabulary set for flashcard creation. Return json only.',
        topic,
        level,
        limit,
        targetLanguage,
        coverageGoal:
          'Cover the topic from multiple useful angles instead of listing many similar words.',
        requirements: [
          `Return exactly ${limit} useful vocabulary items when possible.`,
          'Include a balanced mix of nouns, verbs, adjectives, common phrases, and expressions.',
          'Spread the list across subtopics: people, places, objects, actions, problems, requests, feelings, and real-life situations where relevant.',
          'Avoid narrow synonym clusters. Do not include more than 2 words from the same word family or tiny subtopic.',
          'Prefer high-utility words learners can use in speaking, listening, reading, and everyday scenarios.',
          'Include a few collocations or short phrases when they are more useful than a single word.',
          'Avoid duplicates, obscure words, brand names, proper nouns, and words that are too technical for the requested level.',
          'Definitions must be concise English learner definitions.',
          'Examples must be natural, topic-relevant, and under 16 words.',
          `Translations and example translations must use target language code: ${targetLanguage}.`,
          'Use partOfSpeech values such as noun, verb, adjective, adverb, phrase, collocation, or expression.',
          'Order suggestions from most essential to more specific.',
        ],
        diversityChecklist: [
          'core topic nouns',
          'actions/verbs',
          'describing words',
          'common questions or requests',
          'problems or mistakes',
          'useful phrases/collocations',
          'real-world scenario vocabulary',
        ],
        responseShape: {
          suggestions: [
            {
              word: 'reservation',
              partOfSpeech: 'noun',
              definition: 'An arrangement to keep something for later use.',
              translation: 'target-language translation',
              example: 'I made a reservation for two people.',
              exampleTranslation: 'target-language example translation',
              difficulty: level,
            },
          ],
        },
      }),
      text: {
        format: {
          type: 'json_object',
        },
      },
    };
  }

  private async generateTopicVocabularyWithDatamuse(
    topic: string,
    level: TopicVocabularyLevel,
    limit: number,
    targetLanguage: string,
  ): Promise<TopicVocabularySuggestion[]> {
    try {
      const url = new URL('https://api.datamuse.com/words');
      url.searchParams.set('ml', topic);
      url.searchParams.set('topics', topic);
      url.searchParams.set('max', String(limit));
      url.searchParams.set('md', 'p');

      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(
          `Datamuse topic vocabulary generation failed: ${response.status}`,
        );
        return [];
      }

      const data = (await response.json()) as unknown;
      const suggestions = Array.isArray(data)
        ? (data as DatamuseSuggestion[])
            .map((item) => item.word)
            .filter((word): word is string => !!word)
            .map((word) => word.trim())
            .filter((word) => word.length > 0)
            .slice(0, limit)
        : [];

      return Promise.all(
        suggestions.map(async (word) => ({
          word,
          translation: await this.translateSafely(word, targetLanguage),
          difficulty: level,
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Datamuse topic vocabulary generation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return [];
    }
  }

  private normalizeTopicVocabularySuggestions(
    suggestions: OpenAiTopicVocabularyItem[],
    defaultLevel: TopicVocabularyLevel,
    limit: number,
  ): TopicVocabularySuggestion[] {
    const seen = new Set<string>();
    const normalized: TopicVocabularySuggestion[] = [];

    for (const suggestion of suggestions) {
      const word = suggestion.word?.trim();
      if (!word) continue;

      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      normalized.push({
        word,
        partOfSpeech: suggestion.partOfSpeech?.trim() || undefined,
        definition: suggestion.definition?.trim() || undefined,
        translation: suggestion.translation?.trim() || undefined,
        example: suggestion.example?.trim() || undefined,
        exampleTranslation: suggestion.exampleTranslation?.trim() || undefined,
        difficulty: this.normalizeTopicVocabularyLevel(
          suggestion.difficulty,
          defaultLevel,
        ),
      });

      if (normalized.length >= limit) break;
    }

    return normalized;
  }

  private normalizeTopicVocabularyLevel(
    value: TopicVocabularyLevel | undefined,
    fallback: TopicVocabularyLevel,
  ): TopicVocabularyLevel {
    return value && Object.values(TopicVocabularyLevel).includes(value)
      ? value
      : fallback;
  }

  private extractOpenAiOutputText(
    response: OpenAiResponse,
  ): string | undefined {
    if (response.output_text) return response.output_text;

    return response.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .find((text): text is string => !!text);
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
  ): AudioSuggestion | undefined {
    if (pollyAudioUrl) {
      return {
        url: pollyAudioUrl,
        source: 'polly',
      };
    }

    return undefined;
  }

  private buildSources(
    pronunciation: string | undefined,
    images: FlashcardImageSuggestion[],
    translation?: string,
    pollyAudioUrl?: string,
    exampleSource?: 'vertex' | 'openai' | 'dictionary' | 'database',
  ) {
    return {
      dictionary: pronunciation ? 'datamuse' : undefined,
      translation: translation ? 'aws-translate' : undefined,
      audio: pollyAudioUrl ? 'aws-polly' : undefined,
      examples:
        exampleSource === 'database'
          ? 'database'
          : exampleSource === 'vertex'
            ? 'google-vertex-ai'
            : exampleSource === 'openai'
              ? 'openai'
              : exampleSource === 'dictionary'
                ? 'dictionaryapi.dev'
                : undefined,
      images: [...new Set(images.map((image) => image.source))],
    };
  }
}
