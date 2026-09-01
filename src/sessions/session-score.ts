import { SessionResult } from './session.entity';

export const DEFAULT_CORRECT_SCORE = 10;
export const MAX_SESSION_SCORE = 100;

export function normalizeSessionScore(
  result: SessionResult,
  submittedScore?: number,
): number {
  if (result !== SessionResult.CORRECT) return 0;

  const score =
    typeof submittedScore === 'number' && Number.isFinite(submittedScore)
      ? submittedScore
      : DEFAULT_CORRECT_SCORE;

  return Math.min(MAX_SESSION_SCORE, Math.max(0, Math.floor(score)));
}
