import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { PrepareShadowingDto } from './dto/prepare-shadowing.dto';
import { RecentShadowingVideosDto } from './dto/recent-shadowing-videos.dto';
import { ShadowingResponse, ShadowingService } from './shadowing.service';

@ApiTags('Shadowing')
@ApiBearerAuth('jwt-auth')
@Controller('shadowing')
@UseGuards(JwtAuthGuard)
export class ShadowingController {
  constructor(private readonly shadowingService: ShadowingService) {}

  @Post('prepare')
  @HttpCode(HttpStatus.OK)
  prepare(
    @CurrentUser() user: User,
    @Body() dto: PrepareShadowingDto,
  ): Promise<ShadowingResponse> {
    return this.shadowingService.prepare(user.id, dto);
  }

  @Get('recent')
  getRecent(
    @CurrentUser() user: User,
    @Query() query: RecentShadowingVideosDto,
  ) {
    return this.shadowingService.getRecent(user.id, query.limit);
  }
}
