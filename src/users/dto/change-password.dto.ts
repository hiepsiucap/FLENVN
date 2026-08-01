import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8, example: 'oldSecret123' })
  @IsString()
  @MinLength(8)
  oldPassword!: string;

  @ApiProperty({ minLength: 8, example: 'newSecret123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @ApiProperty({ minLength: 8, example: 'newSecret123' })
  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}
