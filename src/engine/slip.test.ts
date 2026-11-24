import { describe, expect, it } from 'vitest';
import { totalStake } from './payout';
import { clear, closeRound, double, emptySlip, place, rebet, remove, undo, type Slip, type SlipResult } from './slip';

const ok = (r: SlipResult): Slip => {
  if (!r.ok) throw new Error(r.message);
  return r.slip;
};

describe('bet slip', () => {
  it('stacks chips on a spot and undoes one action at a time', () => {
    let s = ok(place(emptySlip(), 'red', 500, 10_000));
    s = ok(place(s, 'red', 100, 10_000));
    s = ok(place(s, 'straight:7', 100, 10_000));
    expect(s.bets).toEqual({ red: 600, 'straight:7': 100 });
    s = ok(undo(s));
    expect(s.bets).toEqual({ red: 600 });
    s = ok(undo(s));
    s = ok(undo(s));
    expect(s.bets).toEqual({});
    expect(undo(s).ok).toBe(false);
  });

  it('clear and remove are themselves undoable', () => {
    let s = ok(place(emptySlip(), 'odd', 500, 10_000));
    s = ok(clear(s));
    expect(s.bets).toEqual({});
    s = ok(undo(s));
    expect(s.bets).toEqual({ odd: 500 });
    s = ok(remove(s, 'odd'));
    expect(ok(undo(s)).bets).toEqual({ odd: 500 });
  });

  it('caps a chip at the spot limit and rejects once full', () => {
    let s = ok(place(emptySlip(), 'straight:0', 9_500, 1_000_000));
    const r = place(s, 'straight:0', 2_500, 1_000_000);
    expect(r.ok && r.capped).toBe(true);
    s = ok(r);
    expect(s.bets['straight:0']).toBe(10_000);
    const full = place(s, 'straight:0', 100, 1_000_000);
    expect(!full.ok && full.reason).toBe('SPOT_LIMIT');
  });

  it('never stakes more than the balance', () => {
    let s = ok(place(emptySlip(), 'red', 2_500, 3_000));
    const r = place(s, 'black', 2_500, 3_000);
    expect(r.ok && r.capped).toBe(true);
    s = ok(r);
    expect(totalStake(s.bets)).toBe(3_000);
    const none = place(s, 'even', 100, 3_000);
    expect(!none.ok && none.reason).toBe('INSUFFICIENT_FUNDS');
  });

  it('double is all-or-nothing', () => {
    const s = ok(place(emptySlip(), 'red', 2_000, 3_000));
    expect(double(s, 3_000).ok).toBe(false);
    expect(ok(double(s, 4_000)).bets).toEqual({ red: 4_000 });
    expect(double(emptySlip(), 10_000).ok).toBe(false);
  });

  it('rebet restores the closed round', () => {
    let s = ok(place(emptySlip(), 'dozen:2', 500, 10_000));
    s = closeRound(s);
    expect(s.bets).toEqual({});
    expect(s.undo).toEqual([]);
    s = ok(rebet(s, 10_000));
    expect(s.bets).toEqual({ 'dozen:2': 500 });
    expect(rebet(closeRound(emptySlip()), 10_000).ok).toBe(false);
    expect(rebet(closeRound(ok(place(emptySlip(), 'red', 500, 500))), 400).ok).toBe(false);
  });

  it('an empty round keeps the previous Rebet source', () => {
    const s = closeRound(ok(place(emptySlip(), 'red', 500, 10_000)));
    expect(closeRound(s).lastRound).toEqual({ red: 500 });
  });
});
