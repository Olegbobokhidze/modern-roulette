/**
 * Bet catalogue (ADR-0003). Every payout follows the single-zero rule `36 / coverage - 1`, which
 * gives the house its 1/37 edge on every bet. A test pins that invariant.
 * All money is integer minor units (cents).
 */
export const BetKind = {
  STRAIGHT: 'straight',
  SPLIT: 'split',
  STREET: 'street',
  TRIO: 'trio',
  CORNER: 'corner',
  FIRST_FOUR: 'firstFour',
  LINE: 'line',
  DOZEN: 'dozen',
  COLUMN: 'column',
  RED: 'red',
  BLACK: 'black',
  EVEN: 'even',
  ODD: 'odd',
  LOW: 'low',
  HIGH: 'high',
} as const;
export type BetKind = (typeof BetKind)[keyof typeof BetKind];

export type BetKindSpec = {
  readonly label: string;
  readonly coverage: number;
  /** Profit multiple: a winning stake of 1 returns 1 + payout. */
  readonly payout: number;
  /** Maximum total stake on one spot of this kind. */
  readonly maxStake: number;
  readonly inside: boolean;
};

export const BET_KINDS: { readonly [K in BetKind]: BetKindSpec } = {
  straight: { label: 'Straight', coverage: 1, payout: 35, maxStake: 10_000, inside: true },
  split: { label: 'Split', coverage: 2, payout: 17, maxStake: 20_000, inside: true },
  street: { label: 'Street', coverage: 3, payout: 11, maxStake: 30_000, inside: true },
  trio: { label: 'Trio', coverage: 3, payout: 11, maxStake: 30_000, inside: true },
  corner: { label: 'Corner', coverage: 4, payout: 8, maxStake: 40_000, inside: true },
  firstFour: { label: 'First four', coverage: 4, payout: 8, maxStake: 40_000, inside: true },
  line: { label: 'Six line', coverage: 6, payout: 5, maxStake: 60_000, inside: true },
  dozen: { label: 'Dozen', coverage: 12, payout: 2, maxStake: 100_000, inside: false },
  column: { label: 'Column', coverage: 12, payout: 2, maxStake: 100_000, inside: false },
  red: { label: 'Red', coverage: 18, payout: 1, maxStake: 200_000, inside: false },
  black: { label: 'Black', coverage: 18, payout: 1, maxStake: 200_000, inside: false },
  even: { label: 'Even', coverage: 18, payout: 1, maxStake: 200_000, inside: false },
  odd: { label: 'Odd', coverage: 18, payout: 1, maxStake: 200_000, inside: false },
  low: { label: '1 to 18', coverage: 18, payout: 1, maxStake: 200_000, inside: false },
  high: { label: '19 to 36', coverage: 18, payout: 1, maxStake: 200_000, inside: false },
};

export const TABLE_LIMITS = {
  /** Smallest chip and smallest total on any one spot. */
  minSpot: 100,
  /** Maximum total stake per round. */
  maxRound: 500_000,
} as const;
