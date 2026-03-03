import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price: number;

  @IsNumber()
  maxBooks: number;

  @IsNumber()
  maxWords: number;

  @IsNumber()
  maxFlashcards: number;

  @IsOptional()
  features?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
