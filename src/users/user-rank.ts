export type UserRankDivision = 'III' | 'II' | 'I';

export interface UserRank {
  slug: string;
  name: string;
  division: UserRankDivision | null;
  displayName: string;
  imageUrl: string;
  nextRank: string | null;
  progressPercent: number;
}

interface UserRankTier {
  slug: string;
  name: string;
  minLevel: number;
  maxLevel: number | null;
}

const RANK_IMAGE_BASE_URL =
  'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/ranks';

export const USER_RANK_TIERS: readonly UserRankTier[] = [
  { slug: 'rookie', name: 'Rookie', minLevel: 1, maxLevel: 4 },
  { slug: 'explorer', name: 'Explorer', minLevel: 5, maxLevel: 9 },
  { slug: 'challenger', name: 'Challenger', minLevel: 10, maxLevel: 19 },
  { slug: 'achiever', name: 'Achiever', minLevel: 20, maxLevel: 34 },
  { slug: 'expert', name: 'Expert', minLevel: 35, maxLevel: 49 },
  { slug: 'master', name: 'Master', minLevel: 50, maxLevel: 69 },
  { slug: 'grandmaster', name: 'Grandmaster', minLevel: 70, maxLevel: 99 },
  { slug: 'flen-legend', name: 'FLEN Legend', minLevel: 100, maxLevel: null },
];

export function getUserRank(level: number): UserRank {
  const normalizedLevel = Math.max(1, Math.floor(level));
  const tierIndex = findTierIndex(normalizedLevel);
  const tier = USER_RANK_TIERS[tierIndex];
  const nextTier = USER_RANK_TIERS[tierIndex + 1];

  if (!nextTier) {
    return {
      slug: tier.slug,
      name: tier.name,
      division: null,
      displayName: tier.name,
      imageUrl: `${RANK_IMAGE_BASE_URL}/${tier.slug}.png`,
      nextRank: null,
      progressPercent: 100,
    };
  }

  const progress =
    (normalizedLevel - tier.minLevel) / (nextTier.minLevel - tier.minLevel);
  const progressPercent = Math.max(0, Math.min(99, Math.floor(progress * 100)));
  const division = getDivision(progress);

  return {
    slug: tier.slug,
    name: tier.name,
    division,
    displayName: `${tier.name} ${division}`,
    imageUrl: `${RANK_IMAGE_BASE_URL}/${tier.slug}.png`,
    nextRank: `${nextTier.name} III`,
    progressPercent,
  };
}

function findTierIndex(level: number): number {
  const index = USER_RANK_TIERS.findIndex(
    (tier) =>
      level >= tier.minLevel &&
      (tier.maxLevel === null || level <= tier.maxLevel),
  );

  return index >= 0 ? index : 0;
}

function getDivision(progress: number): UserRankDivision {
  if (progress < 1 / 3) return 'III';
  if (progress < 2 / 3) return 'II';
  return 'I';
}
