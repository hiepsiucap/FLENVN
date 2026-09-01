import { SessionResult } from './session.entity';
import {
  DEFAULT_CORRECT_SCORE,
  MAX_SESSION_SCORE,
  normalizeSessionScore,
} from './session-score';

describe('normalizeSessionScore', () => {
  it('uses the existing default for a correct answer without score', () => {
    expect(normalizeSessionScore(SessionResult.CORRECT)).toBe(
      DEFAULT_CORRECT_SCORE,
    );
  });

  it('caps a correct answer at 100', () => {
    expect(normalizeSessionScore(SessionResult.CORRECT, 999_999)).toBe(
      MAX_SESSION_SCORE,
    );
  });

  it('floors decimals and prevents negative score', () => {
    expect(normalizeSessionScore(SessionResult.CORRECT, 42.9)).toBe(42);
    expect(normalizeSessionScore(SessionResult.CORRECT, -100)).toBe(0);
  });

  it.each([SessionResult.INCORRECT, SessionResult.SKIPPED])(
    'forces %s score to zero',
    (result) => {
      expect(normalizeSessionScore(result, 100)).toBe(0);
    },
  );
});
