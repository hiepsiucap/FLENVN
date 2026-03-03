import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.usersService.getProfile(req.user.id),
    };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.usersService.updateProfile(
        req.user.id,
        updateProfileDto,
      ),
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.usersService.changePassword(
        req.user.id,
        changePasswordDto,
      ),
    };
  }

  @Get()
  async getAllUsers() {
    return {
      success: true,
      data: await this.usersService.getAllUsers(),
    };
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return {
      success: true,
      data: await this.usersService.getUserById(id),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    return {
      success: true,
      data: await this.usersService.deleteUser(id),
    };
  }
}
