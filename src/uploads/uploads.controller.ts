import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { UploadsService } from './uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth('jwt-auth')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('presign-image')
  async getImageUploadUrl(
    @CurrentUser() user: { id: string },
    @Query() dto: CreateUploadUrlDto,
  ) {
    return this.uploadsService.createImageUploadUrl(user.id, dto);
  }

  @Post('presign-image')
  async createImageUploadUrl(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.uploadsService.createImageUploadUrl(user.id, dto);
  }
}
