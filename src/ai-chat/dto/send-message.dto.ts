import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'What is the difference between say and tell?',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Client-generated idempotency key',
  })
  @IsOptional()
  @IsUUID()
  clientMessageId?: string;
}
