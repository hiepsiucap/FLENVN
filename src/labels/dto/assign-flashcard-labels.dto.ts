import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignFlashcardLabelsDto {
  @ApiProperty({ type: [String], maxItems: 10 })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  labelIds!: string[];
}
