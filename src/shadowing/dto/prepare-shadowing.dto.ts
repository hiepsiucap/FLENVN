import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PrepareShadowingDto {
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=k2h8PvLY6D4' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  url!: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  // Accepted for backward compatibility; cues are no longer split by words.
  @ApiPropertyOptional({ example: 12, default: 12, minimum: 3, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(20)
  maxWordsPerSentence?: number;
}
