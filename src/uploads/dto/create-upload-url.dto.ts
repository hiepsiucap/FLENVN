import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateUploadUrlDto {
  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type of the file to upload',
  })
  @IsString()
  @Matches(/^image\//, { message: 'Only image content types are allowed' })
  contentType!: string;

  @ApiPropertyOptional({
    example: 'avatar.jpg',
    description: 'Original file name, used to preserve extension',
  })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({
    example: 'images',
    description: 'S3 folder prefix',
    default: 'images',
  })
  @IsOptional()
  @IsString()
  folder?: string;
}
