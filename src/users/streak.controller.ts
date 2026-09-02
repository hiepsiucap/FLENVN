import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from './user.entity';
import { UpdateStreakSettingsDto } from './dto/update-streak-settings.dto';
import { UsersService } from './users.service';

@ApiTags('Streak')
@ApiBearerAuth('jwt-auth')
@Controller('streak')
@UseGuards(JwtAuthGuard)
export class StreakController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getStatus(@CurrentUser() user: User) {
    return this.usersService.getStreakStatus(user.id);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateStreakSettingsDto,
  ) {
    return this.usersService.updateStreakSettings(user.id, dto);
  }
}
