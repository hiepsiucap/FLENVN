import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LabelType } from '../label.entity';

export class CreateLabelDto {
  @ApiProperty({ example: 'Important', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ enum: LabelType, default: LabelType.CUSTOM })
  @IsOptional()
  @IsEnum(LabelType)
  type?: LabelType;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}
