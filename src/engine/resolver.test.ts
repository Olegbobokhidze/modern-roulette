import { describe, expect, it } from 'vitest';
import { WHEEL_ORDER, colorOf } from '../config/wheel';
import { POCKET_ARC, TAU, normalizeAngle, pocketAt, pocketOffset, wrapPi } from './resolver';
import { createRng, numberFor } from './rng';

describe('wheel config', () => {
  it('has 37 unique numbers, alternating red and black after zero', () => {
    expect(new Set(WHEEL_ORDER).size).toBe(37);
    for (let i = 1; i < 36; i++) expect(colorOf(WHEEL_ORDER[i] ?? 0)).not.toBe(colorOf(WHEEL_ORDER[i + 1] ?? 0));
  });
});

describe('resolver', () => {
  it('pocketOffset and pocketAt are inverses for every number at any wheel angle', () => {
    const rng = createRng(7);
    for (let n = 0; n <= 36; n++) {
      for (let k = 0; k < 20; k++) {
        const wheel = (rng() - 0.5) * 200;
        const jitter = (rng() - 0.5) * POCKET_ARC * 0.98; // anywhere inside the pocket
        const ball = wheel + pocketOffset(n) + jitter + Math.round((rng() - 0.5) * 10) * TAU;
        expect(pocketAt(wheel, ball).number).toBe(n);
      }
    }
  });

  it('normalises and wraps angles', () => {
    expect(normalizeAngle(-0.5)).toBeCloseTo(TAU - 0.5);
    expect(normalizeAngle(TAU * 3 + 1)).toBeCloseTo(1);
    expect(wrapPi(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
  });
});

describe('rng', () => {
  it('numberFor is deterministic and roughly uniform over 0..36', () => {
    expect(numberFor('s', 'r1')).toBe(numberFor('s', 'r1'));
    const counts = new Array<number>(37).fill(0);
    const N = 37_000;
    for (let i = 0; i < N; i++) counts[numberFor('uniform', `r${i}`)]! += 1;
    // Chi-square, 36 degrees of freedom: p = 0.001 critical value ≈ 67.98.
    const chi = counts.reduce((acc, c) => acc + (c - N / 37) ** 2 / (N / 37), 0);
    expect(chi).toBeLessThan(68);
  });
});
