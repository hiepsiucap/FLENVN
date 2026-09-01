import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OpenAiWordSuggestion {
  partOfSpeech: string;
  definition: string;
  translation: string;
  example: string;
  exampleTranslation: string;
}

interface OpenAiWordSuggestionResponse {
  suggestions?: Array<Partial<OpenAiWordSuggestion>>;
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

@Injectable()
export class WordsExampleService {
  private readonly logger = new Logger(WordsExampleService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateSuggestions(
    word: string,
    targetLanguage: string,
  ): Promise<OpenAiWordSuggestion[]> {
    const apiKey = this.configService.get<string>('services.openai.apiKey');
    if (!apiKey) return [];

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildRequestBody(word, targetLanguage)),
      });

      if (!response.ok) {
        this.logger.warn(
          `OpenAI word suggestion generation failed: ${response.status}`,
        );
        return [];
      }

      const data = (await response.json()) as OpenAiResponse;
      if (data.status === 'incomplete') {
        this.logger.warn(
          `OpenAI word suggestion generation incomplete: ${
            data.incomplete_details?.reason || 'unknown reason'
          }`,
        );
        return [];
      }

      const text = this.extractOutputText(data);
      if (!text) return [];

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
        }));
    } catch (error) {
      this.logger.warn(
        `OpenAI word suggestion generation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return [];
    }
  }

  private buildRequestBody(word: string, targetLanguage: string) {
    const maxOutputTokens = this.configService.get<number>(
      'services.openai.maxTokens',
      1000,
    );
    const effectiveMaxOutputTokens = Math.max(maxOutputTokens, 3000);

    return {
      model: this.configService.get<string>(
        'services.openai.model',
        'gpt-5-nano',
      ),
      store: false,
      max_output_tokens: effectiveMaxOutputTokens,
      reasoning: {
        effort: 'minimal',
      },
      instructions:
        'You are an English-learning dictionary. Independently identify distinct common meanings of the requested English word. Return only valid JSON. Definitions and examples must use concise, natural, beginner-friendly English. Translations must use the requested target language.',
      input: JSON.stringify({
        task: 'Identify up to 5 genuinely distinct dictionary senses of the word. Aim for 3 to 5 only when that many common senses exist; never pad the list with paraphrases or context-only variations. Pair every sense with its own part of speech, translation, example, and example translation.',
        word,
        targetLanguage,
        requirements: [
          'Treat two meanings as distinct only when an English learner would need a different usage rule or target-language translation.',
          'Merge definitions that are merely synonyms or paraphrases of the same sense.',
          'Order meanings from most common to more specific.',
          'Each definition must be a concise English learner definition.',
          'Each translation must be one natural phrase of 1 to 4 words in the target language, with no slash, alternatives, or explanation.',
          'The translation must express the paired definition, not merely a general translation of the word.',
          'Each example must demonstrate exactly its paired definition; reject the pair if substituting the definition into the sentence changes its intended meaning.',
          'Each example must contain the target word or a common inflected form.',
          'Keep each example under 18 words.',
          'Before returning, remove any suggestion whose definition overlaps semantically with another suggestion.',
          'For example, thanking someone for help is a gratitude sense, not the sense of admitting that a fact is true.',
        ],
      }),
      text: {
        format: {
          type: 'json_schema',
          name: 'word_suggestions',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
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
          },
        },
      },
    };
  }

  private extractOutputText(response: OpenAiResponse): string | undefined {
    if (response.output_text) return response.output_text;

    return response.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .find((text): text is string => !!text);
  }
}
