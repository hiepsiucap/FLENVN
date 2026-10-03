import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export enum VocabularyCandidateType {
  WORD = 'word',
  PHRASE = 'phrase',
  PHRASAL_VERB = 'phrasal_verb',
  COLLOCATION = 'collocation',
  IDIOM = 'idiom',
  SENTENCE_PATTERN = 'sentence_pattern',
}

export class DiscoverTopicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  topic!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  targetLanguage?: string;
}

export class VocabularyCandidateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  text!: string;

  @IsEnum(VocabularyCandidateType)
  type!: VocabularyCandidateType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  translation!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  definition!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  example?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;
}

export class SaveVocabularyDto {
  @IsUUID('4')
  bookId!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => VocabularyCandidateDto)
  candidates!: VocabularyCandidateDto[];
}
