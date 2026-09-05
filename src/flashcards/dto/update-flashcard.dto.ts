import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartOfSpeech } from '../part-of-speech.enum';

export class UpdateFlashcardDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100, example: 'resilient' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word?: string;

  @ApiPropertyOptional({ enum: PartOfSpeech, example: PartOfSpeech.NOUN })
  @IsOptional()
  @IsEnum(PartOfSpeech)
  partOfSpeech?: PartOfSpeech;

  @ApiPropertyOptional({ example: '/rɪˈzɪl.i.ənt/' })
  @IsOptional()
  @IsString()
  pronunciation?: string;

  @ApiPropertyOptional({
    example: 'Able to recover quickly from difficulties.',
  })
  @IsOptional()
  @IsString()
  definition?: string;

  @ApiPropertyOptional({ example: 'linh hoat' })
  @IsOptional()
  @IsString()
  translation?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/audio.mp3' })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/image.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'She remained resilient under pressure.' })
  @IsOptional()
  @IsString()
  example?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/example-audio.mp3',
  })
  @IsOptional()
  @IsString()
  exampleAudioUrl?: string;

  @ApiPropertyOptional({ example: 'Co ay van kien cu duoi ap luc.' })
  @IsOptional()
  @IsString()
  exampleTranslation?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  labelIds?: string[];
}
