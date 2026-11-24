import { describe, expect, it } from 'vitest';
import { settle, totalStake } from './payout';

describe('settle', () => {
  it('returns stake + profit on winners and nothing on losers', () => {
    const s = settle({ 'straight:17': 100, red: 500, 'split:17-20': 200, 'dozen:3': 300 }, 17);
    // 17 is black: red loses. Straight 35:1, split 17:1, dozen 3 (25–36) loses.
    expect(s.totalStake).toBe(1100);
    expect(s.totalReturned).toBe(100 * 36 + 200 * 18);
    expect(s.net).toBe(s.totalReturned - 1100);
    expect(s.spots.find((x) => x.spotId === 'red')?.won).toBe(false);
  });

  it('zero loses every outside bet (no la partage)', () => {
    const s = settle({ red: 1000, black: 1000, even: 1000, odd: 1000, low: 1000, high: 1000 }, 0);
    expect(s.totalReturned).toBe(0);
    expect(s.net).toBe(-6000);
  });

  it('covering every number with straights returns 36 of every 37 units', () => {
    const bets: Record<string, number> = {};
    for (let n = 0; n <= 36; n++) bets[`straight:${n}`] = 100;
    for (let n = 0; n <= 36; n++) expect(settle(bets, n).net).toBe(-100);
    expect(totalStake(bets)).toBe(3700);
  });

  it('rejects unknown spots loudly (server-side guard)', () => {
    expect(() => settle({ 'straight:99': 100 }, 1)).toThrow();
  });
});
