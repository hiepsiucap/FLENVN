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
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // Plan Management (Admin endpoints)
  @Post('plans')
  async createPlan(@Body() createPlanDto: CreateSubscriptionPlanDto) {
    return {
      success: true,
      data: await this.subscriptionsService.createPlan(createPlanDto),
    };
  }

  @Get('plans')
  async getAllPlans() {
    return {
      success: true,
      data: await this.subscriptionsService.getAllPlans(),
    };
  }

  @Get('plans/:id')
  async getPlanById(@Param('id') id: string) {
    return {
      success: true,
      data: await this.subscriptionsService.getPlanById(id),
    };
  }

  @Put('plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() updatePlanDto: Partial<CreateSubscriptionPlanDto>,
  ) {
    return {
      success: true,
      data: await this.subscriptionsService.updatePlan(id, updatePlanDto),
    };
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.OK)
  async deletePlan(@Param('id') id: string) {
    return {
      success: true,
      data: await this.subscriptionsService.deletePlan(id),
    };
  }

  // User Subscription Management
  @Get('my-subscription')
  @UseGuards(JwtAuthGuard)
  async getUserSubscription(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.subscriptionsService.getUserSubscription(req.user.id),
    };
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async upgradeSubscription(
    @Request() req: AuthenticatedRequest,
    @Body() upgradeDto: UpgradeSubscriptionDto,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.subscriptionsService.upgradeSubscription(
        req.user.id,
        upgradeDto,
      ),
    };
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async getUsageStats(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.subscriptionsService.getUsageStats(req.user.id),
    };
  }

  @Post('check-book-limit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async canAddBook(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    const canAdd = await this.subscriptionsService.canAddBook(req.user.id);
    return {
      success: true,
      data: { canAdd },
    };
  }

  @Post('check-words-limit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async canAddWords(
    @Request() req: AuthenticatedRequest,
    @Body('wordsCount') wordsCount: number,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    const canAdd = await this.subscriptionsService.canAddWords(
      req.user.id,
      wordsCount,
    );
    return {
      success: true,
      data: { canAdd },
    };
  }
}
