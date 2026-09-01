import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionResult } from '../session.entity';

export class PracticeGameResultDto {
  @ApiProperty({ example: 'translation-input' })
  @IsString()
  gameType!: string;

  @ApiProperty({ enum: SessionResult })
  @IsEnum(SessionResult)
  result!: SessionResult;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  responseTime?: number;

  @ApiPropertyOptional({ example: 10, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;
}

export class PracticeFlashcardResultDto {
  @ApiProperty({ example: 'flashcard-id' })
  @IsUUID()
  flashcardId!: string;

  @ApiProperty({ minimum: 0, maximum: 5, example: 4 })
  @IsInt()
  @Min(0)
  @Max(5)
  quality!: number;

  @ApiProperty({ type: [PracticeGameResultDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PracticeGameResultDto)
  games!: PracticeGameResultDto[];
}

export class CreatePracticeSessionDto {
  @ApiPropertyOptional({ example: 'book-id' })
  @IsOptional()
  @IsUUID()
  bookId?: string;

  @ApiPropertyOptional({ example: 180000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @ApiProperty({ type: [PracticeFlashcardResultDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PracticeFlashcardResultDto)
  flashcards!: PracticeFlashcardResultDto[];
}
