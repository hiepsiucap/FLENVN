import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SuggestWordDto {
  @ApiProperty({ example: 'apple' })
  @IsString()
  @MaxLength(100)
  word!: string;

  @ApiPropertyOptional({ example: 'vi', default: 'vi' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  targetLanguage?: string;

  @ApiPropertyOptional({ example: 3, default: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  imageLimit?: number;
}
