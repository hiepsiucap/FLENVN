import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum EnglishLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'Difference between say and tell' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  targetLanguage?: string;

  @ApiPropertyOptional({ enum: EnglishLevel, example: EnglishLevel.B1 })
  @IsOptional()
  @IsEnum(EnglishLevel)
  englishLevel?: EnglishLevel;
}
