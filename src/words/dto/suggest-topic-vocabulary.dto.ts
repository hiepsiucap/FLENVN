import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum TopicVocabularyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export class SuggestTopicVocabularyDto {
  @ApiProperty({ example: 'restaurant English' })
  @IsString()
  @MaxLength(100)
  topic!: string;

  @ApiPropertyOptional({
    enum: TopicVocabularyLevel,
    example: TopicVocabularyLevel.BEGINNER,
  })
  @IsOptional()
  @IsEnum(TopicVocabularyLevel)
  level?: TopicVocabularyLevel;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ example: 'vi', default: 'vi' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  targetLanguage?: string;
}
