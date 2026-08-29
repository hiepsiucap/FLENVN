import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlashcardAudioService } from '../flashcards/flashcard-audio.service';
import {
  FlashcardImageService,
  FlashcardImageSuggestion,
} from '../flashcards/flashcard-image.service';
import { TranslateService } from '../translate/translate.service';
import { AutocompleteWordDto } from './dto/autocomplete-word.dto';
import { CorrectTextDto } from './dto/correct-text.dto';
import { SuggestWordDto } from './dto/suggest-word.dto';
import {
  SuggestTopicVocabularyDto,
  TopicVocabularyLevel,
} from './dto/suggest-topic-vocabulary.dto';
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
  suggestions: WordLearningCombo[];
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

export interface WordLearningCombo {
  definition: DefinitionSuggestion;
  definitionTranslation?: string;
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

  constructor(
    private readonly configService: ConfigService,
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

    const [
      translation,
      definitionTranslations,
      translatedExamples,
      audioUrl,
      images,
    ] = await Promise.all([
      this.translateSafely(word, targetLanguage),
      Promise.all(
        definitions.map((definition) =>
          this.translateSafely(definition.text, targetLanguage),
        ),
      ),
      this.translateExamples(finalExamples, targetLanguage),
      this.flashcardAudioService.createAudioUrl(userId, word),
      this.flashcardImageService.findImageUrls(word, imageLimit),
    ]);

    const suggestions = definitions.map((definition, index) => {
      const example =
        finalExamples.find(
          (candidate) =>
            candidate.partOfSpeech &&
            candidate.partOfSpeech === definition.partOfSpeech,
        ) || finalExamples[index];
      const exampleIndex = example ? finalExamples.indexOf(example) : -1;

      return {
        definition,
        definitionTranslation: definitionTranslations[index],
        translation,
        example: example
          ? { ...example, translation: translatedExamples[exampleIndex] }
          : undefined,
      };
    });

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
      suggestions,
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

  private extractDefinitions(
    items: DictionaryResponseItem[],
  ): DefinitionSuggestion[] {
    const definitions = items
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
      );
    // Put different parts of speech first, then fill remaining slots.
    const prioritized: DefinitionSuggestion[] = [];
    const remaining: DefinitionSuggestion[] = [];
    const seenPartsOfSpeech = new Set<string>();

    for (const definition of definitions) {
      const partOfSpeech = definition.partOfSpeech?.toLowerCase();
      if (partOfSpeech && !seenPartsOfSpeech.has(partOfSpeech)) {
        seenPartsOfSpeech.add(partOfSpeech);
        prioritized.push(definition);
      } else {
        remaining.push(definition);
      }
    }

    return [...prioritized, ...remaining].slice(0, 5);
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
