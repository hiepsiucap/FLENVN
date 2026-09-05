import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ExplainWordInContextDto {
  @ApiProperty({
    example: 'The bank raised interest rates again this morning.',
    description: 'A sentence or paragraph containing the target word.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  @ApiProperty({ example: 'bank' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word!: string;

  @ApiPropertyOptional({ example: 'vi', default: 'vi' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  targetLanguage?: string;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    minimum: 0,
    maximum: 99,
    description:
      'Zero-based occurrence to use when the word appears more than once.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  occurrenceIndex?: number;

  @ApiPropertyOptional({ example: 3, default: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  imageLimit?: number;
}
