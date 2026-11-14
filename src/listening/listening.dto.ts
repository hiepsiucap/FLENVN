import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { ListeningGame } from './listening-content';

export class GenerateListeningDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  flashcardIds!: string[];
  @IsIn(['quick-reply', 'catch-details', 'conversation']) game!: ListeningGame;
  @IsIn(['easy', 'medium', 'hard']) difficulty!: 'easy' | 'medium' | 'hard';
}
export class AnswerListeningDto {
  @IsString() @MaxLength(20) questionId!: string;
  @IsString() @MaxLength(200) answer!: string;
}

export class SentenceAudioDto {
  @IsUUID('4') flashcardId!: string;
}
