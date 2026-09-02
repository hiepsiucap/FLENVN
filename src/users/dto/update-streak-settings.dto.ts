import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateStreakSettingsDto {
  @ApiPropertyOptional({ minimum: 10, maximum: 20000, example: 100 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(20000)
  dailyTarget?: number;

  @ApiPropertyOptional({ example: 'Asia/Bangkok' })
  @IsOptional()
  @IsString()
  timezone?: string;
}
