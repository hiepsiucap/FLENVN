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

export interface UserRankTier {
  slug: string;
  name: string;
  minLevel: number;
  maxLevel: number | null;
  title: string;
  subtitle: string;
  description: string;
  fomoText: string;
}

const RANK_IMAGE_BASE_URL =
  'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/ranks';
const XP_PER_LEVEL = 1_000;

export const USER_RANK_TIERS: readonly UserRankTier[] = [
  {
    slug: 'rookie',
    name: 'Rookie',
    minLevel: 1,
    maxLevel: 4,
    title: 'Your journey starts here',
    subtitle: 'Every legend begins with one new word.',
    description: 'Build your first learning streak and master the basics.',
    fomoText: 'Reach Level 5 to leave Rookie behind and unlock Explorer.',
  },
  {
    slug: 'explorer',
    name: 'Explorer',
    minLevel: 5,
    maxLevel: 9,
    title: 'New territory unlocked',
    subtitle: 'Your vocabulary is starting to open new worlds.',
    description: 'Explore more words, contexts, and ways to communicate.',
    fomoText: 'Keep moving—Challenger is closer than it looks.',
  },
  {
    slug: 'challenger',
    name: 'Challenger',
    minLevel: 10,
    maxLevel: 19,
    title: 'The challenge is on',
    subtitle: 'Consistency is separating you from casual learners.',
    description: 'Turn daily practice into a serious learning advantage.',
    fomoText: 'Do not stop now—Achiever begins at Level 20.',
  },
  {
    slug: 'achiever',
    name: 'Achiever',
    minLevel: 20,
    maxLevel: 34,
    title: 'Momentum looks good on you',
    subtitle: 'You have built progress worth protecting.',
    description: 'Your consistent practice is producing visible results.',
    fomoText: 'Expert is your next major milestone. Protect your momentum.',
  },
  {
    slug: 'expert',
    name: 'Expert',
    minLevel: 35,
    maxLevel: 49,
    title: 'Knowledge becomes instinct',
    subtitle: 'You are operating beyond everyday practice.',
    description: 'Apply a broad vocabulary with confidence and precision.',
    fomoText:
      'Master status is within reach, but only consistency gets you there.',
  },
  {
    slug: 'master',
    name: 'Master',
    minLevel: 50,
    maxLevel: 69,
    title: 'Command the language',
    subtitle: 'Your discipline has become a competitive edge.',
    description: 'Use language naturally across increasingly complex contexts.',
    fomoText: 'Grandmaster is reserved for learners who keep showing up.',
  },
  {
    slug: 'grandmaster',
    name: 'Grandmaster',
    minLevel: 70,
    maxLevel: 99,
    title: 'Among the elite',
    subtitle: 'Very few learning journeys reach this level of commitment.',
    description: 'Demonstrate exceptional range, recall, and consistency.',
    fomoText: 'One final ascent remains before FLEN Legend.',
  },
  {
    slug: 'flen-legend',
    name: 'FLEN Legend',
    minLevel: 100,
    maxLevel: null,
    title: 'Your legacy is now part of FLEN',
    subtitle: 'You reached the rank every learner can see but few will claim.',
    description: 'The highest recognition for sustained language mastery.',
    fomoText: 'Stay active and defend the legacy you worked to build.',
  },
];

export function getRankImageUrl(slug: string): string {
  return `${RANK_IMAGE_BASE_URL}/${slug}.png`;
}

export function getUserRank(level: number, exp?: number): UserRank {
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
      imageUrl: getRankImageUrl(tier.slug),
      nextRank: null,
      progressPercent:
        exp === undefined ? 100 : getLevelProgressPercent(normalizedLevel, exp),
    };
  }

  const progress =
    (normalizedLevel - tier.minLevel) / (nextTier.minLevel - tier.minLevel);
  const progressPercent =
    exp === undefined
      ? Math.max(0, Math.min(99, Math.floor(progress * 100)))
      : getLevelProgressPercent(normalizedLevel, exp);
  const division = getDivision(progress);

  return {
    slug: tier.slug,
    name: tier.name,
    division,
    displayName: `${tier.name} ${division}`,
    imageUrl: getRankImageUrl(tier.slug),
    nextRank: `${nextTier.name} III`,
    progressPercent,
  };
}

function getLevelProgressPercent(level: number, exp: number): number {
  const currentLevelStartExp = (level - 1) * XP_PER_LEVEL;

  return Math.max(
    0,
    Math.min(
      99,
      Math.floor(
        ((Math.max(0, exp) - currentLevelStartExp) / XP_PER_LEVEL) * 100,
      ),
    ),
  );
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
