import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CorrectTextDto {
  @ApiProperty({ example: 'she go to school yesterday' })
  @IsString()
  @MaxLength(1000)
  text!: string;

  @ApiPropertyOptional({ example: 'en-US', default: 'en-US' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;
}
