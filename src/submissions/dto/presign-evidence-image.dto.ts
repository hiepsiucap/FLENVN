import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class PresignEvidenceImageDto {
  @ApiProperty({
    enum: ['image/jpeg', 'image/png', 'image/webp'],
    example: 'image/png',
  })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;

  @ApiPropertyOptional({ example: 'screenshot.png', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}
