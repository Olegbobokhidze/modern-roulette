import { describe, expect, it } from 'vitest';
import { RoundEvent, RoundState, TRANSITIONS, step } from './machine';

describe('round machine', () => {
  it('walks the happy path', () => {
    let s: RoundState = RoundState.BETTING;
    for (const e of [RoundEvent.SPIN, RoundEvent.OUTCOME, RoundEvent.LANDED, RoundEvent.NEXT_ROUND]) {
      const r = step(s, e);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.to;
    }
    expect(s).toBe(RoundState.BETTING);
  });

  it('rejects everything not in the whitelist', () => {
    const events = Object.values(RoundEvent);
    let legal = 0;
    for (const s of Object.values(RoundState)) {
      for (const e of events) {
        const r = step(s, e);
        if (r.ok) legal++;
        expect(r.ok).toBe(TRANSITIONS[s][e] !== undefined);
      }
    }
    expect(legal).toBe(7);
    expect(step('SPINNING', 'SPIN').ok).toBe(false);
    expect(step('REQUESTING', 'SPIN').ok).toBe(false);
  });
});
