import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { UploadsService } from './uploads.service';
import type { BufferedUploadFile } from './uploads.service';

const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
];

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

  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadAudio(
    @CurrentUser() user: { id: string },
    @UploadedFile() file?: BufferedUploadFile,
  ) {
    if (!file) throw new BadRequestException('Choose an audio file');
    if (!AUDIO_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Choose an MP3, M4A, WAV, or WebM audio file',
      );
    }
    return this.uploadsService.uploadFile(
      user.id,
      file,
      'audio/flashcards',
      AUDIO_MIME_TYPES,
    );
  }
}
