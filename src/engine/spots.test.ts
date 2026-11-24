import { describe, expect, it } from 'vitest';
import type { BetKind } from '../config/bets';
import { BET_KINDS } from '../config/bets';
import { POCKET_COUNT } from '../config/wheel';
import { SPOTS, getSpot } from './spots';

describe('bet catalogue', () => {
  it('builds every single-zero spot exactly once', () => {
    const count = (k: BetKind) => SPOTS.filter((s) => s.kind === k).length;
    expect(count('straight')).toBe(37);
    expect(count('split')).toBe(33 + 24 + 3);
    expect(count('street')).toBe(12);
    expect(count('trio')).toBe(2);
    expect(count('corner')).toBe(22);
    expect(count('firstFour')).toBe(1);
    expect(count('line')).toBe(11);
    expect(count('dozen')).toBe(3);
    expect(count('column')).toBe(3);
    expect(new Set(SPOTS.map((s) => s.id)).size).toBe(SPOTS.length);
  });

  it('every spot covers exactly its kind’s coverage of distinct, valid numbers', () => {
    for (const s of SPOTS) {
      expect(new Set(s.numbers).size, s.id).toBe(BET_KINDS[s.kind].coverage);
      for (const n of s.numbers) expect(n >= 0 && n <= 36, s.id).toBe(true);
    }
  });

  it('pays 36/coverage − 1 on every kind (uniform 1/37 house edge)', () => {
    for (const [kind, spec] of Object.entries(BET_KINDS)) {
      expect(spec.payout, kind).toBe(36 / spec.coverage - 1);
      const rtp = (spec.coverage / POCKET_COUNT) * (spec.payout + 1);
      expect(rtp).toBeCloseTo(36 / 37, 10);
    }
  });

  it('places adjacent numbers into splits and corners correctly', () => {
    expect(getSpot('split:17-20')?.numbers).toEqual([17, 20]);
    expect(getSpot('split:17-18')?.numbers).toEqual([17, 18]);
    expect(getSpot('split:18-19')).toBeUndefined(); // 18 is top of its column, 19 starts the next
    expect(getSpot('corner:17')?.numbers).toEqual([17, 18, 20, 21]);
    expect(getSpot('column:1')?.numbers.slice(0, 3)).toEqual([1, 4, 7]);
    expect(getSpot('column:3')?.numbers.slice(-1)).toEqual([36]);
    expect(getSpot('red')?.numbers).toContain(1);
    expect(getSpot('black')?.numbers).toContain(2);
  });

  it('zero is covered only by straight, zero splits, trios and first four', () => {
    const kinds = new Set(SPOTS.filter((s) => s.numbers.includes(0)).map((s) => s.kind));
    expect([...kinds].sort()).toEqual(['firstFour', 'split', 'straight', 'trio']);
  });
});
