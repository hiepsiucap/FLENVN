import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export interface OpenAiWordSuggestion {
  partOfSpeech: string;
  definition: string;
  translation: string;
  example: string;
  exampleTranslation: string;
  source: 'vertex';
}

interface OpenAiWordSuggestionResponse {
  suggestions?: Array<Partial<OpenAiWordSuggestion>>;
}

export interface ContextualWordExplanation {
  partOfSpeech: string;
  definition: string;
  translation: string;
  exampleTranslation: string;
  explanation: string;
  example: string;
  generatedExample: boolean;
  source: 'vertex';
}

interface ContextualWordExplanationResponse {
  partOfSpeech?: string;
  definition?: string;
  translation?: string;
  exampleTranslation?: string;
  explanation?: string;
  example?: string;
  generatedExample?: boolean;
}

@Injectable()
export class WordsExampleService {
  private readonly logger = new Logger(WordsExampleService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateSuggestions(
    word: string,
    targetLanguage: string,
  ): Promise<OpenAiWordSuggestion[]> {
    const primaryModel = this.configService.get<string>(
      'services.vertex.model',
      'gemini-3.5-flash-lite',
    );
    const primarySuggestions = await this.generateWithVertex(
      word,
      targetLanguage,
      primaryModel,
    );
    if (primarySuggestions.length > 0) return primarySuggestions;

    const fallbackModel = this.configService.get<string>(
      'services.vertex.fallbackModel',
      'gemini-3.5-flash',
    );
    if (fallbackModel === primaryModel) return [];

    this.logger.warn(
      `Vertex AI primary model returned no valid suggestions; using ${fallbackModel}`,
    );
    return this.generateWithVertex(word, targetLanguage, fallbackModel);
  }

  async explainInContext(
    word: string,
    matchedForm: string,
    context: string,
    example: string,
    targetLanguage: string,
  ): Promise<ContextualWordExplanation | undefined> {
    const primaryModel = this.configService.get<string>(
      'services.vertex.model',
      'gemini-3.5-flash-lite',
    );
    const primary = await this.explainInContextWithVertex(
      word,
      matchedForm,
      context,
      example,
      targetLanguage,
      primaryModel,
    );
    if (primary) return primary;

    const fallbackModel = this.configService.get<string>(
      'services.vertex.fallbackModel',
      'gemini-3.5-flash',
    );
    if (fallbackModel === primaryModel) return undefined;

    this.logger.warn(
      `Vertex contextual explanation failed validation; using ${fallbackModel}`,
    );
    return this.explainInContextWithVertex(
      word,
      matchedForm,
      context,
      example,
      targetLanguage,
      fallbackModel,
    );
  }

  private async explainInContextWithVertex(
    word: string,
    matchedForm: string,
    context: string,
    example: string,
    targetLanguage: string,
    model: string,
  ): Promise<ContextualWordExplanation | undefined> {
    const project = this.configService.get<string>('services.vertex.project');
    if (!project) return undefined;

    try {
      const client = new GoogleGenAI({
        vertexai: true,
        project,
        location: this.configService.get<string>(
          'services.vertex.location',
          'global',
        ),
      });
      const response = await client.models.generateContent({
        model,
        contents: this.buildContextPrompt(
          word,
          matchedForm,
          context,
          example,
          targetLanguage,
        ),
        config: {
          temperature: 0,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
          responseJsonSchema: this.buildContextSchema(),
        },
      });
      const parsed = this.parseContextExplanation(response.text);
      if (
        !parsed ||
        !this.hasExpectedContextWritingSystem(parsed, targetLanguage)
      ) {
        return undefined;
      }
      return parsed;
    } catch (error) {
      this.logger.warn(
        `Vertex contextual model ${model} failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return undefined;
    }
  }

  private parseContextExplanation(
    text: string | undefined,
  ): ContextualWordExplanation | undefined {
    if (!text) return undefined;
    try {
      const parsed = JSON.parse(text) as ContextualWordExplanationResponse;
      if (
        !parsed.partOfSpeech?.trim() ||
        !parsed.definition?.trim() ||
        !parsed.translation?.trim() ||
        !parsed.exampleTranslation?.trim() ||
        !parsed.explanation?.trim() ||
        !parsed.example?.trim() ||
        typeof parsed.generatedExample !== 'boolean'
      ) {
        return undefined;
      }
      return {
        partOfSpeech: parsed.partOfSpeech.trim(),
        definition: parsed.definition.trim(),
        translation: parsed.translation.trim(),
        exampleTranslation: parsed.exampleTranslation.trim(),
        explanation: parsed.explanation.trim(),
        example: parsed.example.trim(),
        generatedExample: parsed.generatedExample,
        source: 'vertex',
      };
    } catch {
      return undefined;
    }
  }

  private hasExpectedContextWritingSystem(
    result: ContextualWordExplanation,
    targetLanguage: string,
  ): boolean {
    if (targetLanguage.toLowerCase() !== 'vi') return true;
    return this.containsVietnameseDiacritics(
      `${result.translation} ${result.exampleTranslation} ${result.explanation}`,
    );
  }

  private async generateWithVertex(
    word: string,
    targetLanguage: string,
    model: string,
  ): Promise<OpenAiWordSuggestion[]> {
    const project = this.configService.get<string>('services.vertex.project');
    if (!project) return [];

    try {
      const client = new GoogleGenAI({
        vertexai: true,
        project,
        location: this.configService.get<string>(
          'services.vertex.location',
          'global',
        ),
      });
      const response = await client.models.generateContent({
        model,
        contents: this.buildPrompt(word, targetLanguage),
        config: {
          temperature: 0,
          maxOutputTokens: this.configService.get<number>(
            'services.vertex.maxOutputTokens',
            3000,
          ),
          responseMimeType: 'application/json',
          responseJsonSchema: this.buildSuggestionSchema(),
        },
      });

      const suggestions = this.parseSuggestions(response.text);
      if (!this.hasExpectedWritingSystem(suggestions, targetLanguage)) {
        this.logger.warn(
          `${model} returned Vietnamese text without expected diacritics`,
        );
        return [];
      }
      return suggestions;
    } catch (error) {
      this.logger.warn(
        `Vertex AI model ${model} failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return [];
    }
  }

  private parseSuggestions(text: string | undefined): OpenAiWordSuggestion[] {
    if (!text) return [];

    try {
      const parsed = JSON.parse(text) as OpenAiWordSuggestionResponse;
      return (parsed.suggestions || [])
        .filter((suggestion): suggestion is OpenAiWordSuggestion =>
          Boolean(
            suggestion.partOfSpeech?.trim() &&
            suggestion.definition?.trim() &&
            suggestion.translation?.trim() &&
            suggestion.example?.trim() &&
            suggestion.exampleTranslation?.trim(),
          ),
        )
        .slice(0, 5)
        .map((suggestion) => ({
          partOfSpeech: suggestion.partOfSpeech.trim(),
          definition: suggestion.definition.trim(),
          translation: suggestion.translation.trim(),
          example: suggestion.example.trim(),
          exampleTranslation: suggestion.exampleTranslation.trim(),
          source: 'vertex',
        }));
    } catch (error) {
      this.logger.warn(
        `AI word suggestion response was invalid: ${
          error instanceof Error ? error.message : 'Invalid JSON'
        }`,
      );
      return [];
    }
  }

  private hasExpectedWritingSystem(
    suggestions: OpenAiWordSuggestion[],
    targetLanguage: string,
  ): boolean {
    if (suggestions.length === 0) return false;
    if (targetLanguage.toLowerCase() !== 'vi') return true;

    const translatedText = suggestions
      .flatMap((suggestion) => [
        suggestion.translation,
        suggestion.exampleTranslation,
      ])
      .join(' ');

    return this.containsVietnameseDiacritics(translatedText);
  }

  private containsVietnameseDiacritics(text: string): boolean {
    return /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/iu.test(
      text,
    );
  }

  private buildContextPrompt(
    word: string,
    matchedForm: string,
    context: string,
    example: string,
    targetLanguage: string,
  ): string {
    return [
      'You are a conservative bilingual English dictionary editor.',
      'Identify only the single meaning of the target word used in the supplied context.',
      'Do not list alternative senses.',
      'Decide whether the supplied example is a complete, natural sentence with enough context to identify the sense.',
      'If it is complete, copy it exactly into example and set generatedExample to false.',
      'If it is incomplete, a fragment, or only the word, create one concise natural sentence using the target word, put it in example, and set generatedExample to true.',
      'When context does not identify a sense, use the most common everyday sense and make the generated example unambiguous.',
      'Translate the final example field faithfully and naturally into exampleTranslation.',
      'The definition must be concise, beginner-friendly English.',
      'The translation must be a natural 1-to-4-word equivalent of this exact contextual sense and match its part of speech.',
      'The explanation must briefly explain in the target language why this meaning fits the context.',
      'Silently verify that definition, translation, part of speech, and example translation all express the same sense.',
      targetLanguage.toLowerCase() === 'vi'
        ? 'Write all Vietnamese fields in standard Unicode Vietnamese with full tone marks and diacritics; never use ASCII-only Vietnamese.'
        : `Write translated fields in language code ${targetLanguage}.`,
      `Base word: ${JSON.stringify(word)}`,
      `Matched form in example: ${JSON.stringify(matchedForm)}`,
      `Full context: ${JSON.stringify(context)}`,
      `Example sentence to translate: ${JSON.stringify(example)}`,
    ].join('\n');
  }

  private buildContextSchema() {
    return {
      type: 'object',
      properties: {
        partOfSpeech: { type: 'string' },
        definition: { type: 'string' },
        translation: { type: 'string' },
        exampleTranslation: { type: 'string' },
        explanation: { type: 'string' },
        example: { type: 'string' },
        generatedExample: { type: 'boolean' },
      },
      required: [
        'partOfSpeech',
        'definition',
        'translation',
        'exampleTranslation',
        'explanation',
        'example',
        'generatedExample',
      ],
      additionalProperties: false,
    };
  }

  private buildPrompt(word: string, targetLanguage: string): string {
    return [
      'ROLE: You are a conservative bilingual English dictionary editor for learners who speak the requested target language.',
      'TASK: Return only well-established, common dictionary senses of the requested English word as structured JSON.',
      targetLanguage.toLowerCase() === 'vi'
        ? 'TARGET LANGUAGE: Vietnamese (vi). Write standard Vietnamese with full Unicode tone marks and diacritics. Never return romanized or ASCII-only Vietnamese.'
        : `TARGET LANGUAGE CODE: ${targetLanguage}.`,
      '',
      'SENSE SELECTION:',
      '- Return 1 to 5 senses. There is no target or minimum count. Fewer correct senses are better than extra uncertain senses.',
      '- Never invent, infer, or stretch a sense to increase the count.',
      '- Exclude rare, archaic, highly technical, phrase-only, and context-only senses.',
      '- Merge senses that an English learner would use with the same rule and target-language translation.',
      '- Order senses by everyday frequency.',
      '',
      'FIELD RULES FOR EVERY SENSE:',
      '- partOfSpeech must describe the target word as used in the example: noun, verb, adjective, adverb, phrase, or expression.',
      '- definition must be short, precise, beginner-friendly English and must define only that sense.',
      '- translation must be the most common natural equivalent in the requested target language for that exact definition and the same part of speech, not a literal word-by-word rendering or broad association.',
      '- translation must contain 1 to 4 words, with no slash, alternatives, parentheses, or explanation.',
      '- example must contain the target word or a normal inflected form and use exactly the defined sense.',
      '- example must be natural, unambiguous, and under 18 words.',
      '- exampleTranslation must be a faithful, idiomatic translation of the whole example in the requested target language.',
      '',
      'MANDATORY SILENT VALIDATION — discard the entire sense if any check fails:',
      '1. Back-translate translation into English: it must match definition, including part of speech.',
      '2. Substitute definition for the target word in example: the intended meaning and subject/object roles must remain the same.',
      '3. Confirm exampleTranslation expresses the same event, tense, subject, and object as example.',
      '4. Read translation and exampleTranslation as a native speaker would; discard or rewrite awkward, uncommon, or word-for-word phrasing.',
      '5. Confirm this sense does not overlap another returned sense.',
      '6. Confirm you are certain this is a standard dictionary sense of the standalone target word.',
      '',
      'COMMON ERRORS TO AVOID:',
      '- Do not translate an adjective meaning "unkind" as a narrower adjective meaning only "stingy".',
      '- Do not translate a noun as a verb; for example, an accusation is not "to accuse".',
      '- Do not combine two senses in one definition when the translation or example demonstrates only one.',
      '- Do not use a passive or irregular form if it changes who performs the action defined.',
      `Word: ${JSON.stringify(word)}`,
      `Translation language code: ${JSON.stringify(targetLanguage)}`,
    ].join('\n');
  }

  private buildSuggestionSchema() {
    return {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          maxItems: 5,
          items: {
            type: 'object',
            properties: {
              partOfSpeech: { type: 'string' },
              definition: { type: 'string' },
              translation: { type: 'string' },
              example: { type: 'string' },
              exampleTranslation: { type: 'string' },
            },
            required: [
              'partOfSpeech',
              'definition',
              'translation',
              'example',
              'exampleTranslation',
            ],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    };
  }
}
