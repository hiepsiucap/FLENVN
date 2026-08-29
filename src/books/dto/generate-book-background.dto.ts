import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GenerateBookBackgroundDto {
  @ApiProperty({ minLength: 3, maxLength: 255, example: 'English Basics' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    maxLength: 2000,
    example: 'A beginner guide for Vietnamese learners practicing English.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 4,
    default: 3,
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  count?: number;

  @ApiPropertyOptional({
    enum: ['auto', 'low', 'medium', 'high'],
    default: 'medium',
  })
  @IsOptional()
  @IsIn(['auto', 'low', 'medium', 'high'])
  quality?: 'auto' | 'low' | 'medium' | 'high';

  @ApiPropertyOptional({
    enum: ['1024x1024', '1536x1024', '1024x1536'],
    default: '1536x1024',
  })
  @IsOptional()
  @IsIn(['1024x1024', '1536x1024', '1024x1536'])
  size?: '1024x1024' | '1536x1024' | '1024x1536';
}
