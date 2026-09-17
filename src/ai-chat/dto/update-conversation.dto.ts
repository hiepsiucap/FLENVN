import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EnglishLevel } from './create-conversation.dto';

export class UpdateConversationDto {
  @ApiPropertyOptional({ example: 'Say vs. Tell' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: 'vi' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  targetLanguage?: string;

  @ApiPropertyOptional({ enum: EnglishLevel, nullable: true })
  @IsOptional()
  @IsEnum(EnglishLevel)
  englishLevel?: EnglishLevel | null;
}
