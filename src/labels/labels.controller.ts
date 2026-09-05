import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/user.entity';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelsService } from './labels.service';

@ApiTags('Labels')
@ApiBearerAuth('jwt-auth')
@UseGuards(JwtAuthGuard)
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  createLabel(@CurrentUser() user: User, @Body() dto: CreateLabelDto) {
    return this.labelsService.createLabel(user.id, dto);
  }

  @Get()
  getLabels(
    @CurrentUser() user: User,
    @Query('includeCounts', new ParseBoolPipe({ optional: true }))
    includeCounts?: boolean,
  ) {
    return this.labelsService.getLabels(user.id, includeCounts);
  }

  @Put(':id')
  updateLabel(
    @CurrentUser() user: User,
    @Param('id') labelId: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.labelsService.updateLabel(user.id, labelId, dto);
  }

  @Delete(':id')
  deleteLabel(@CurrentUser() user: User, @Param('id') labelId: string) {
    return this.labelsService.deleteLabel(user.id, labelId);
  }
}
