import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SubmissionStatus } from '../submission.entity';

export class UpdateSubmissionStatusDto {
  @ApiProperty({ enum: SubmissionStatus })
  @IsEnum(SubmissionStatus)
  status!: SubmissionStatus;
}
