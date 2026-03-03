import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateFlashcardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word: string;

  @IsOptional()
  @IsString()
  pronunciation?: string;

  @IsOptional()
  @IsString()
  definition?: string;

  @IsOptional()
  @IsString()
  translation?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  example?: string;

  @IsOptional()
  @IsString()
  exampleTranslation?: string;

  @IsOptional()
  @IsString()
  bookId?: string;
}
