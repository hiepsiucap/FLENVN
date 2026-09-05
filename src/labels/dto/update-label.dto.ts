import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateLabelDto {
  @ApiPropertyOptional({ example: 'Important', minLength: 1, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: '#3B82F6', nullable: true })
  @IsOptional()
  @IsHexColor()
  color?: string;
}
