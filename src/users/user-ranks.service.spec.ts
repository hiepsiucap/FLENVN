import type { User } from './user.entity';
import { UserRanksService } from './user-ranks.service';

describe('UserRanksService', () => {
  it('returns the complete catalog and personalized rank information', async () => {
    const repository = {
      count: jest.fn().mockResolvedValueOnce(100).mockResolvedValueOnce(9),
    };
    const service = new UserRanksService(repository as never);
    const user = {
      level: 17,
      exp: 16_750,
      streak: 12,
    } as User;

    const response = await service.getRankCatalog(user);

    expect(response.ranks).toHaveLength(8);
    expect(response.ranks.find((rank) => rank.slug === 'rookie')).toEqual(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(response.ranks.find((rank) => rank.slug === 'challenger')).toEqual(
      expect.objectContaining({
        status: 'current',
        title: 'The challenge is on',
        imageUrl:
          'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/ranks/challenger.png',
      }),
    );
    expect(response.ranks.find((rank) => rank.slug === 'achiever')).toEqual(
      expect.objectContaining({
        status: 'locked',
        levelsRemaining: 3,
      }),
    );
    expect(response.currentUser).toEqual(
      expect.objectContaining({
        level: 17,
        exp: 16_750,
        levelProgressPercent: 75,
        nextMilestoneText: 'Only 3 levels left to unlock Achiever.',
        streakText: 'Do not break your 12-day streak.',
      }),
    );
    expect(response.currentUser.standing).toEqual({
      position: 10,
      totalUsers: 100,
      topPercent: 10,
      surpassedPercent: 90,
      fomoText: 'You are among the top 10% of active FLEN learners.',
    });
  });

  it('returns final-rank and first-user fallback copy', async () => {
    const repository = {
      count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    };
    const service = new UserRanksService(repository as never);
    const user = { level: 100, exp: 100_000, streak: 0 } as User;

    const response = await service.getRankCatalog(user);

    expect(response.currentUser.currentRank.slug).toBe('flen-legend');
    expect(response.currentUser.nextMilestoneText).toContain(
      'defend your legacy',
    );
    expect(response.currentUser.standing.fomoText).toBe(
      'You are setting the pace. Keep building your lead.',
    );
  });
});
