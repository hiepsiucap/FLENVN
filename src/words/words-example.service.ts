import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DefinitionSuggestion, ExampleSuggestion } from './words.service';

interface OpenAiExample {
  text?: string;
  meaning?: string | null;
  partOfSpeech?: string | null;
}

interface OpenAiExampleResponse {
  examples?: Array<OpenAiExample | string>;
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

  async generateExamples(
    word: string,
    definitions: DefinitionSuggestion[],
  ): Promise<ExampleSuggestion[]> {
    const apiKey = this.configService.get<string>('services.openai.apiKey');
    if (!apiKey) return [];

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildRequestBody(word, definitions)),
      });

      if (!response.ok) {
        this.logger.warn(
          `OpenAI example generation failed: ${response.status}`,
        );
        return [];
      }

      const data = (await response.json()) as OpenAiResponse;
      if (data.status === 'incomplete') {
        this.logger.warn(
          `OpenAI example generation incomplete: ${
            data.incomplete_details?.reason || 'unknown reason'
          }`,
        );
        return [];
      }

      const text = this.extractOutputText(data);
      if (!text) return [];

      const parsed = JSON.parse(text) as OpenAiExampleResponse;

      return (parsed.examples || [])
        .map((example) =>
          typeof example === 'string'
            ? {
                text: example,
              }
            : example,
        )
        .filter((example): example is OpenAiExample & { text: string } =>
          Boolean(example.text),
        )
        .slice(0, 4)
        .map((example) => ({
          text: example.text,
          meaning: example.meaning || undefined,
          partOfSpeech: example.partOfSpeech || undefined,
          source: 'openai',
        }));
    } catch (error) {
      this.logger.warn(
        `OpenAI example generation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return [];
    }
  }

  private buildRequestBody(word: string, definitions: DefinitionSuggestion[]) {
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
        'You create concise English-learning example sentences. Return only valid JSON. Use natural, beginner-friendly English.',
      input: JSON.stringify({
        task: 'Generate 3 to 4 example sentences for the word. Use different meanings, parts of speech, or contexts when possible. Return json with an examples array of objects. Each object must have text, meaning, and partOfSpeech.',
        word,
        definitions: definitions.slice(0, 6),
        requirements: [
          'Each example must contain the target word exactly or a common inflected form.',
          'Examples should be useful for English learners.',
          'Avoid duplicate meanings.',
          'Keep each example under 18 words.',
        ],
      }),
      text: {
        format: {
          type: 'json_object',
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
