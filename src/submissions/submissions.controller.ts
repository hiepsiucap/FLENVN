import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UploadsService } from '../uploads/uploads.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/user.entity';
import { PresignEvidenceImageDto } from './dto/presign-evidence-image.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionStatusDto } from './dto/update-submission-status.dto';
import { SubmissionType } from './submission.entity';
import { SubmissionsService } from './submissions.service';

@ApiTags('Submissions')
@ApiBearerAuth('jwt-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Post('feedback')
  createFeedback(@CurrentUser() user: User, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(
      user.id,
      SubmissionType.FEEDBACK,
      dto,
    );
  }

  @Post('reports')
  createReport(@CurrentUser() user: User, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(user.id, SubmissionType.REPORT, dto);
  }

  @Post('submissions/evidence-image')
  async uploadEvidenceImage(
    @CurrentUser() user: User,
    @Body() dto: PresignEvidenceImageDto,
  ) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(dto.contentType)) {
      throw new BadRequestException('Choose a JPEG, PNG, or WebP image');
    }
    return this.uploadsService.createImageUploadUrl(user.id, {
      contentType: dto.contentType,
      fileName: dto.fileName,
      folder: 'images/submissions',
    });
  }

  @Get('submissions/mine')
  findMine(@CurrentUser() user: User) {
    return this.submissionsService.findMine(user.id);
  }

  @Get('submissions/mine/:id')
  findMineById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissionsService.findMineById(user.id, id);
  }

  @Patch('submissions/:id/status')
  @UseGuards(AdminGuard)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubmissionStatusDto,
  ) {
    return this.submissionsService.updateStatus(id, dto.status);
  }

  @Get('submissions')
  @UseGuards(AdminGuard)
  findAll() {
    return this.submissionsService.findAll();
  }
}
