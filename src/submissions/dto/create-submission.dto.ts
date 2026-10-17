import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSubmissionDto {
  @ApiPropertyOptional({ maxLength: 150, example: 'Audio playback' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 5000,
    example: 'The audio does not play on this card.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;

  @ApiPropertyOptional({
    description: 'URL returned by POST /submissions/evidence-image',
  })
  @IsOptional()
  @IsUrl({ require_tld: true, protocols: ['https'] })
  @MaxLength(1000)
  evidenceImageUrl?: string;
}
