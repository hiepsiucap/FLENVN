import { normalizeLabelName } from './label-taxonomy';

describe('label taxonomy', () => {
  it('normalizes whitespace and casing for uniqueness', () => {
    expect(normalizeLabelName('  TrAvEl  ')).toBe('travel');
  });
});
