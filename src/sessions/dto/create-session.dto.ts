import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionType, SessionResult } from '../session.entity';

export class CreateSessionDto {
  @ApiProperty({ enum: SessionType })
  @IsEnum(SessionType)
  type!: SessionType;

  @ApiProperty({ enum: SessionResult })
  @IsEnum(SessionResult)
  result!: SessionResult;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsNumber()
  responseTime?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional({ readOnly: true, description: 'Set from route param' })
  flashcardId?: string; // Will be set from param
}
