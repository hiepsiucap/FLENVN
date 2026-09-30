import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SearchVocabularyDto {
  @ApiProperty({ example: 'bank', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word!: string;

  @ApiProperty({ enum: ['en', 'vi'], example: 'en' })
  @IsIn(['en', 'vi'])
  language!: 'en' | 'vi';

  @ApiPropertyOptional({ example: 'She went to the bank.', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  context?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  bookId?: string;
}
