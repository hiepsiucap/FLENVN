import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { UserSubscription } from './user-subscription.entity';
import { User } from '../users/user.entity';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(UserSubscription)
    private readonly userSubscriptionRepository: Repository<UserSubscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Plan Management
  async createPlan(
    createPlanDto: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const plan = this.planRepository.create({
      ...createPlanDto,
      features: createPlanDto.features || {},
    });
    return this.planRepository.save(plan);
  }

  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return this.planRepository.find({ where: { isActive: true } });
  }

  async getPlanById(id: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  async updatePlan(
    id: string,
    updatePlanDto: Partial<CreateSubscriptionPlanDto>,
  ): Promise<SubscriptionPlan> {
    const plan = await this.getPlanById(id);
    Object.assign(plan, updatePlanDto);
    return this.planRepository.save(plan);
  }

  async deletePlan(id: string): Promise<{ message: string }> {
    const plan = await this.getPlanById(id);
    await this.planRepository.remove(plan);
    return { message: 'Plan deleted successfully' };
  }

  // User Subscription Management
  async assignFreePlan(userId: string): Promise<UserSubscription> {
    const freePlan = await this.planRepository.findOne({
      where: { name: 'Free' },
    });

    if (!freePlan) {
      throw new NotFoundException('Free plan not found');
    }

    const subscription = new UserSubscription();
    subscription.userId = userId;
    subscription.planId = freePlan.id;
    subscription.startDate = new Date();
    subscription.endDate = null;
    subscription.isActive = true;

    return this.userSubscriptionRepository.save(subscription);
  }

  async getUserSubscription(userId: string): Promise<UserSubscription> {
    const subscription = await this.userSubscriptionRepository.findOne({
      where: { userId, isActive: true },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    return subscription;
  }

  async upgradeSubscription(
    userId: string,
    upgradeDto: UpgradeSubscriptionDto,
  ): Promise<UserSubscription> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newPlan = await this.getPlanById(upgradeDto.planId);

    // Deactivate old subscription
    const oldSubscription = await this.userSubscriptionRepository.findOne({
      where: { userId, isActive: true },
    });

    if (oldSubscription) {
      oldSubscription.isActive = false;
      await this.userSubscriptionRepository.save(oldSubscription);
    }

    // Create new subscription
    const subscription = new UserSubscription();
    subscription.userId = userId;
    subscription.planId = newPlan.id;
    subscription.startDate = new Date();
    subscription.endDate = null;
    subscription.isActive = true;

    return this.userSubscriptionRepository.save(subscription);
  }

  // Usage Validation
  async canAddBook(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !subscription) {
      return false;
    }

    return user.booksCount < subscription.plan.maxBooks;
  }

  async canAddWords(userId: string, wordsCount: number): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !subscription) {
      return false;
    }

    return user.totalWordsUsed + wordsCount <= subscription.plan.maxWords;
  }

  async getUsageStats(userId: string): Promise<{
    currentPlan: SubscriptionPlan;
    booksUsed: number;
    booksLimit: number;
    wordsUsed: number;
    wordsLimit: number;
    percentageUsed: {
      books: number;
      words: number;
    };
  }> {
    const subscription = await this.getUserSubscription(userId);
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const booksPercentage = Math.round(
      (user.booksCount / subscription.plan.maxBooks) * 100,
    );
    const wordsPercentage = Math.round(
      (user.totalWordsUsed / subscription.plan.maxWords) * 100,
    );

    return {
      currentPlan: subscription.plan,
      booksUsed: user.booksCount,
      booksLimit: subscription.plan.maxBooks,
      wordsUsed: user.totalWordsUsed,
      wordsLimit: subscription.plan.maxWords,
      percentageUsed: {
        books: booksPercentage,
        words: wordsPercentage,
      },
    };
  }

  async updateUserUsage(
    userId: string,
    booksIncrement: number = 0,
    wordsIncrement: number = 0,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.booksCount += booksIncrement;
    user.totalWordsUsed += wordsIncrement;
    await this.userRepository.save(user);
  }
}
