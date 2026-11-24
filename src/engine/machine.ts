/**
 * Round state machine (ADR-0002). A whitelist table is the only source of legal transitions, and an
 * illegal event is returned as a rejection (logged by the controller), never thrown.
 *
 *   BETTING ─SPIN→ REQUESTING ─OUTCOME→ SPINNING ─LANDED→ RESULT ─NEXT_ROUND→ BETTING
 *                      │  ▲
 *                FAILURE  RETRY
 *                      ▼  │
 *                     ERROR ─DISMISS→ BETTING
 */
export const RoundState = {
  BETTING: 'BETTING',
  REQUESTING: 'REQUESTING',
  SPINNING: 'SPINNING',
  RESULT: 'RESULT',
  ERROR: 'ERROR',
} as const;
export type RoundState = (typeof RoundState)[keyof typeof RoundState];

export const RoundEvent = {
  SPIN: 'SPIN',
  OUTCOME: 'OUTCOME',
  FAILURE: 'FAILURE',
  LANDED: 'LANDED',
  NEXT_ROUND: 'NEXT_ROUND',
  RETRY: 'RETRY',
  DISMISS: 'DISMISS',
} as const;
export type RoundEvent = (typeof RoundEvent)[keyof typeof RoundEvent];

export const TRANSITIONS: { readonly [S in RoundState]: Partial<Record<RoundEvent, RoundState>> } = {
  BETTING: { SPIN: 'REQUESTING' },
  REQUESTING: { OUTCOME: 'SPINNING', FAILURE: 'ERROR' },
  SPINNING: { LANDED: 'RESULT' },
  RESULT: { NEXT_ROUND: 'BETTING' },
  ERROR: { RETRY: 'REQUESTING', DISMISS: 'BETTING' },
};

export type Step = { readonly ok: true; readonly from: RoundState; readonly to: RoundState } | { readonly ok: false; readonly from: RoundState };

export function step(state: RoundState, event: RoundEvent): Step {
  const to = TRANSITIONS[state][event];
  return to ? { ok: true, from: state, to } : { ok: false, from: state };
}

/** Betting actions (place, undo, clear, rebet, double) are legal only while the felt is open. */
export const isFeltOpen = (s: RoundState): boolean => s === RoundState.BETTING || s === RoundState.RESULT;
