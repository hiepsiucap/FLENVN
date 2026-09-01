import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { User } from './user.entity';
import {
  getRankImageUrl,
  getUserRank,
  USER_RANK_TIERS,
  UserRank,
  UserRankTier,
} from './user-rank';

const XP_PER_LEVEL = 1_000;

export type RankUnlockStatus = 'completed' | 'current' | 'locked';

export interface RankCatalogItem extends UserRankTier {
  imageUrl: string;
  divisions: Array<'III' | 'II' | 'I'>;
  status: RankUnlockStatus;
  levelsRemaining: number;
  unlockText: string;
}

export interface UserRankStanding {
  position: number;
  totalUsers: number;
  topPercent: number;
  surpassedPercent: number;
  fomoText: string;
}

export interface RankCatalogResponse {
  systemVersion: number;
  xpPerLevel: number;
  ranks: RankCatalogItem[];
  currentUser: {
    level: number;
    exp: number;
    streak: number;
    currentRank: UserRank;
    currentLevelStartExp: number;
    nextLevelExp: number;
    levelProgressPercent: number;
    nextMilestoneText: string;
    streakText: string;
    standing: UserRankStanding;
  };
}

@Injectable()
export class UserRanksService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getRankCatalog(user: User): Promise<RankCatalogResponse> {
    const [totalUsers, usersAhead] = await Promise.all([
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({
        where: { isActive: true, exp: MoreThan(user.exp) },
      }),
    ]);
    const normalizedTotal = Math.max(1, totalUsers);
    const position = Math.min(normalizedTotal, usersAhead + 1);
    const currentRank = getUserRank(user.level);
    const currentLevelStartExp = (Math.max(1, user.level) - 1) * XP_PER_LEVEL;
    const nextLevelExp = Math.max(1, user.level) * XP_PER_LEVEL;

    return {
      systemVersion: 1,
      xpPerLevel: XP_PER_LEVEL,
      ranks: USER_RANK_TIERS.map((tier) =>
        this.buildCatalogItem(tier, user.level),
      ),
      currentUser: {
        level: user.level,
        exp: user.exp,
        streak: user.streak,
        currentRank,
        currentLevelStartExp,
        nextLevelExp,
        levelProgressPercent: Math.max(
          0,
          Math.min(
            99,
            Math.floor(
              ((user.exp - currentLevelStartExp) / XP_PER_LEVEL) * 100,
            ),
          ),
        ),
        nextMilestoneText: this.getNextMilestoneText(user.level),
        streakText:
          user.streak > 0
            ? `Do not break your ${user.streak}-day streak.`
            : 'Start a streak today and make your progress harder to lose.',
        standing: this.buildStanding(position, normalizedTotal),
      },
    };
  }

  private buildCatalogItem(tier: UserRankTier, level: number): RankCatalogItem {
    const status = this.getUnlockStatus(tier, level);
    const levelsRemaining = Math.max(0, tier.minLevel - level);

    return {
      ...tier,
      imageUrl: getRankImageUrl(tier.slug),
      divisions: tier.maxLevel === null ? [] : ['III', 'II', 'I'],
      status,
      levelsRemaining,
      unlockText:
        status === 'completed'
          ? 'Unlocked'
          : status === 'current'
            ? `Your current rank: ${getUserRank(level).displayName}`
            : `Only ${levelsRemaining} level${levelsRemaining === 1 ? '' : 's'} left to unlock ${tier.name}.`,
    };
  }

  private getUnlockStatus(tier: UserRankTier, level: number): RankUnlockStatus {
    if (level < tier.minLevel) return 'locked';
    if (tier.maxLevel !== null && level > tier.maxLevel) return 'completed';
    return 'current';
  }

  private getNextMilestoneText(level: number): string {
    const nextTier = USER_RANK_TIERS.find((tier) => tier.minLevel > level);

    if (!nextTier) {
      return 'You reached FLEN Legend. Keep learning to defend your legacy.';
    }

    const remaining = nextTier.minLevel - level;
    return `Only ${remaining} level${remaining === 1 ? '' : 's'} left to unlock ${nextTier.name}.`;
  }

  private buildStanding(
    position: number,
    totalUsers: number,
  ): UserRankStanding {
    const topPercent = Math.max(
      1,
      Math.min(100, Math.ceil((position / totalUsers) * 100)),
    );
    const surpassedPercent = Math.max(
      0,
      Math.floor(((totalUsers - position) / totalUsers) * 100),
    );

    return {
      position,
      totalUsers,
      topPercent,
      surpassedPercent,
      fomoText: this.getStandingText(
        position,
        totalUsers,
        topPercent,
        surpassedPercent,
      ),
    };
  }

  private getStandingText(
    position: number,
    totalUsers: number,
    topPercent: number,
    surpassedPercent: number,
  ): string {
    if (totalUsers === 1) {
      return 'You are setting the pace. Keep building your lead.';
    }
    if (position === 1) {
      return `You are #1 among ${totalUsers} active FLEN learners.`;
    }
    if (topPercent <= 10) {
      return `You are among the top ${topPercent}% of active FLEN learners.`;
    }
    if (surpassedPercent > 0) {
      return `You have moved ahead of ${surpassedPercent}% of active FLEN learners.`;
    }
    return 'Your next session is another chance to move up the ranks.';
  }
}
