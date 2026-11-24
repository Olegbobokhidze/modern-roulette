/** Settlement maths (ADR-0003). Integer minor units throughout, with no floating-point money. */
import { getSpot, specOf, spotWins, type SpotId } from './spots';

export type Bets = Readonly<Record<SpotId, number>>;

export type SpotResult = {
  readonly spotId: SpotId;
  readonly stake: number;
  readonly won: boolean;
  /** Profit only (stake × payout); 0 when lost. */
  readonly profit: number;
  /** What goes back to the player: stake + profit, or 0. */
  readonly returned: number;
};

export type Settlement = {
  readonly number: number;
  readonly totalStake: number;
  readonly totalReturned: number;
  /** totalReturned − totalStake. */
  readonly net: number;
  readonly spots: readonly SpotResult[];
};

export function totalStake(bets: Bets): number {
  let t = 0;
  for (const v of Object.values(bets)) t += v;
  return t;
}

export function settle(bets: Bets, number: number): Settlement {
  const spots: SpotResult[] = [];
  let stakeSum = 0;
  let returned = 0;
  for (const [spotId, stake] of Object.entries(bets)) {
    if (stake <= 0) continue;
    const s = getSpot(spotId);
    if (!s) throw new RangeError(`Unknown spot ${spotId}`);
    const won = spotWins(s, number);
    const profit = won ? stake * specOf(s).payout : 0;
    const back = won ? stake + profit : 0;
    stakeSum += stake;
    returned += back;
    spots.push({ spotId, stake, won, profit, returned: back });
  }
  return { number, totalStake: stakeSum, totalReturned: returned, net: returned - stakeSum, spots };
}
