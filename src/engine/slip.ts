/**
 * The bet slip: what is on the felt, plus undo history and the previous round for Rebet.
 * Pure functions return a new slip or a typed rejection, and they never throw (AGENTS.md §3).
 */
import { TABLE_LIMITS } from '../config/bets';
import { totalStake, type Bets } from './payout';
import { getSpot, specOf, type SpotId } from './spots';

export type Slip = {
  readonly bets: Bets;
  /** Previous `bets` states, newest last. Undo pops one. */
  readonly undo: readonly Bets[];
  /** Bets of the last settled round, for Rebet. */
  readonly lastRound: Bets | null;
};

export const RejectReason = {
  UNKNOWN_SPOT: 'UNKNOWN_SPOT',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  SPOT_LIMIT: 'SPOT_LIMIT',
  ROUND_LIMIT: 'ROUND_LIMIT',
  NOTHING_TO_UNDO: 'NOTHING_TO_UNDO',
  NOTHING_TO_CLEAR: 'NOTHING_TO_CLEAR',
  NO_PREVIOUS_ROUND: 'NO_PREVIOUS_ROUND',
  NOTHING_TO_DOUBLE: 'NOTHING_TO_DOUBLE',
} as const;
export type RejectReason = (typeof RejectReason)[keyof typeof RejectReason];

export type SlipResult =
  | { readonly ok: true; readonly slip: Slip; readonly capped: boolean }
  | { readonly ok: false; readonly reason: RejectReason; readonly message: string };

const UNDO_DEPTH = 50;
const reject = (reason: RejectReason, message: string): SlipResult => ({ ok: false, reason, message });

export const emptySlip = (): Slip => ({ bets: {}, undo: [], lastRound: null });

function commit(slip: Slip, bets: Bets, capped = false): SlipResult {
  return { ok: true, capped, slip: { ...slip, bets, undo: [...slip.undo, slip.bets].slice(-UNDO_DEPTH) } };
}

/** Why a full bet map cannot be staked against `balance`, or null if it can. */
export function validateBets(bets: Bets, balance: number): { reason: RejectReason; message: string } | null {
  let total = 0;
  for (const [id, amount] of Object.entries(bets)) {
    const s = getSpot(id);
    if (!s) return { reason: RejectReason.UNKNOWN_SPOT, message: `Unknown spot ${id}` };
    if (amount > specOf(s).maxStake) return { reason: RejectReason.SPOT_LIMIT, message: `${s.label} is above its limit` };
    total += amount;
  }
  if (total > TABLE_LIMITS.maxRound) return { reason: RejectReason.ROUND_LIMIT, message: 'Round limit reached' };
  if (total > balance) return { reason: RejectReason.INSUFFICIENT_FUNDS, message: 'Not enough balance' };
  return null;
}

/**
 * Add `amount` to a spot. If the full amount does not fit (spot limit, round limit or balance), it is
 * capped to what fits and `capped` is set. It is rejected only when nothing meaningful fits.
 */
export function place(slip: Slip, spotId: SpotId, amount: number, balance: number): SlipResult {
  const s = getSpot(spotId);
  if (!s) return reject(RejectReason.UNKNOWN_SPOT, `Unknown spot ${spotId}`);
  const current = slip.bets[spotId] ?? 0;
  const total = totalStake(slip.bets);
  const roomSpot = specOf(s).maxStake - current;
  const roomRound = TABLE_LIMITS.maxRound - total;
  const roomFunds = balance - total;
  const add = Math.min(amount, roomSpot, roomRound, roomFunds);
  if (add <= 0 || current + add < TABLE_LIMITS.minSpot) {
    const binding = Math.min(roomSpot, roomRound, roomFunds);
    if (binding === roomFunds) return reject(RejectReason.INSUFFICIENT_FUNDS, 'Not enough balance');
    if (binding === roomSpot) return reject(RejectReason.SPOT_LIMIT, `${s.label} is at its limit`);
    return reject(RejectReason.ROUND_LIMIT, 'Round limit reached');
  }
  return commit(slip, { ...slip.bets, [spotId]: current + add }, add < amount);
}

export function remove(slip: Slip, spotId: SpotId): SlipResult {
  if (!(spotId in slip.bets)) return reject(RejectReason.NOTHING_TO_CLEAR, 'No chips on that spot');
  const { [spotId]: _gone, ...rest } = slip.bets;
  return commit(slip, rest);
}

export function undo(slip: Slip): SlipResult {
  const prev = slip.undo[slip.undo.length - 1];
  if (!prev) return reject(RejectReason.NOTHING_TO_UNDO, 'Nothing to undo');
  return { ok: true, capped: false, slip: { ...slip, bets: prev, undo: slip.undo.slice(0, -1) } };
}

export function clear(slip: Slip): SlipResult {
  if (Object.keys(slip.bets).length === 0) return reject(RejectReason.NOTHING_TO_CLEAR, 'The table is already clear');
  return commit(slip, {});
}

/** Replace the felt with the previous round's bets, all-or-nothing. */
export function rebet(slip: Slip, balance: number): SlipResult {
  if (!slip.lastRound || Object.keys(slip.lastRound).length === 0) return reject(RejectReason.NO_PREVIOUS_ROUND, 'No previous round to repeat');
  const err = validateBets(slip.lastRound, balance);
  if (err) return reject(err.reason, err.message);
  return commit(slip, slip.lastRound);
}

/** Double every stake, all-or-nothing, so the layout keeps its proportions. */
export function double(slip: Slip, balance: number): SlipResult {
  const entries = Object.entries(slip.bets);
  if (entries.length === 0) return reject(RejectReason.NOTHING_TO_DOUBLE, 'Place a bet to double');
  const doubled: Record<SpotId, number> = {};
  for (const [id, v] of entries) doubled[id] = v * 2;
  const err = validateBets(doubled, balance);
  if (err) return reject(err.reason, err.message);
  return commit(slip, doubled);
}

/** Close a settled round: the felt clears, history resets, and the round becomes Rebet's source. */
export function closeRound(slip: Slip): Slip {
  const had = Object.keys(slip.bets).length > 0;
  return { bets: {}, undo: [], lastRound: had ? slip.bets : slip.lastRound };
}
