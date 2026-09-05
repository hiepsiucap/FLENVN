import { LabelType } from './label.entity';

export const TOPIC_LABELS = [
  'travel',
  'food-and-drink',
  'business',
  'education',
  'technology',
  'health',
  'family',
  'relationships',
  'shopping',
  'transportation',
  'work',
  'finance',
  'environment',
  'entertainment',
  'sports',
  'home',
  'clothing',
  'emotions',
  'communication',
  'daily-life',
] as const;

export const LEVEL_LABELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const USAGE_LABELS = [
  'formal',
  'informal',
  'academic',
  'slang',
  'technical',
] as const;

export interface ClassifiedLabel {
  name: string;
  type: LabelType.TOPIC | LabelType.LEVEL | LabelType.USAGE;
}

export function normalizeLabelName(name: string): string {
  return name.trim().toLocaleLowerCase('en-US');
}
