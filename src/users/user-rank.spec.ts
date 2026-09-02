import { getUserRank } from './user-rank';

describe('getUserRank', () => {
  it.each([
    [1, 'rookie', 'Rookie III'],
    [4, 'rookie', 'Rookie I'],
    [5, 'explorer', 'Explorer III'],
    [10, 'challenger', 'Challenger III'],
    [17, 'challenger', 'Challenger I'],
    [20, 'achiever', 'Achiever III'],
    [35, 'expert', 'Expert III'],
    [50, 'master', 'Master III'],
    [70, 'grandmaster', 'Grandmaster III'],
  ])('maps level %i to %s', (level, expectedSlug, expectedDisplayName) => {
    const rank = getUserRank(level);

    expect(rank.slug).toBe(expectedSlug);
    expect(rank.displayName).toBe(expectedDisplayName);
    expect(rank.imageUrl).toBe(
      `https://flenvn.s3.ap-southeast-1.amazonaws.com/images/ranks/${expectedSlug}.png`,
    );
  });

  it('returns final rank metadata for level 100 and above', () => {
    expect(getUserRank(120)).toEqual(
      expect.objectContaining({
        slug: 'flen-legend',
        name: 'FLEN Legend',
        division: null,
        displayName: 'FLEN Legend',
        nextRank: null,
        progressPercent: 100,
      }),
    );
  });

  it('returns progress toward the next rank', () => {
    expect(getUserRank(17)).toEqual(
      expect.objectContaining({
        nextRank: 'Achiever III',
        progressPercent: 70,
      }),
    );
  });

  it('returns EXP progress toward the next level when EXP is provided', () => {
    expect(getUserRank(1, 81).progressPercent).toBe(8);
    expect(getUserRank(17, 16_750).progressPercent).toBe(75);
  });
});
