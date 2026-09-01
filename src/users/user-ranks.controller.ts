import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from './user.entity';
import { UserRanksService } from './user-ranks.service';

@ApiTags('Ranks')
@ApiBearerAuth('jwt-auth')
@Controller('ranks')
@UseGuards(JwtAuthGuard)
export class UserRanksController {
  constructor(private readonly userRanksService: UserRanksService) {}

  @Get()
  getRankCatalog(@CurrentUser() user: User) {
    return this.userRanksService.getRankCatalog(user);
  }
}
