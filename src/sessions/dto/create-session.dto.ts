import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { SessionType, SessionResult } from '../session.entity';

export class CreateSessionDto {
  @IsEnum(SessionType)
  type: SessionType;

  @IsEnum(SessionResult)
  result: SessionResult;

  @IsOptional()
  @IsNumber()
  responseTime?: number;

  @IsOptional()
  @IsNumber()
  score?: number;

  flashcardId: string; // Will be set from param
}
