import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TranslateTextDto {
  @ApiProperty({
    example: 'Hello world',
    description: 'Text to translate',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;

  @ApiPropertyOptional({
    example: 'We sat on the bank of the river and watched the sunset.',
    description:
      'Full surrounding passage containing the text. Used only to understand context; only text is translated.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  context?: string;

  @ApiProperty({
    example: 'vi',
    description: 'Target language code (ISO 639-1)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(10)
  targetLanguage!: string;

  @ApiPropertyOptional({
    example: 'en',
    description:
      'Source language code. Use auto-detect by omitting this field.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  sourceLanguage?: string;
}
