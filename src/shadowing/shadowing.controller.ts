import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrepareShadowingDto } from './dto/prepare-shadowing.dto';
import { ShadowingResponse, ShadowingService } from './shadowing.service';

@ApiTags('Shadowing')
@ApiBearerAuth('jwt-auth')
@Controller('shadowing')
@UseGuards(JwtAuthGuard)
export class ShadowingController {
  constructor(private readonly shadowingService: ShadowingService) {}

  @Post('prepare')
  @HttpCode(HttpStatus.OK)
  prepare(@Body() dto: PrepareShadowingDto): Promise<ShadowingResponse> {
    return this.shadowingService.prepare(dto);
  }
}
