import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Free' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Default free plan' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 0 })
  @IsNumber()
  price!: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  maxBooks!: number;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  maxWords!: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  maxFlashcards!: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: { exportEnabled: false },
  })
  @IsOptional()
  features?: Record<string, boolean>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
