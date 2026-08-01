import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpgradeSubscriptionDto {
  @ApiProperty({ example: 'f2e9b30d-2ac8-4b57-a0f6-3acda8e1f4f3' })
  @IsString()
  planId!: string;
}
