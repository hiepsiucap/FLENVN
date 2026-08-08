import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AutocompleteWordDto {
  @ApiProperty({ example: 'resil' })
  @IsString()
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({ example: 8, default: 8, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
