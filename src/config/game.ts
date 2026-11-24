/** Session-level settings: currency, wallet, chips and timings. Money is integer minor units. */
export const CURRENCY = { code: 'EUR', locale: 'en-IE' } as const;

export const STARTING_BALANCE = 100_000; // €1,000.00

export const ChipTone = { BONE: 'bone', SLATE: 'slate', SAGE: 'sage', OXBLOOD: 'oxblood', CHAMPAGNE: 'champagne' } as const;
export type ChipTone = (typeof ChipTone)[keyof typeof ChipTone];

export type ChipSpec = { readonly value: number; readonly tone: ChipTone; readonly key: string };

export const CHIPS: readonly ChipSpec[] = [
  { value: 100, tone: ChipTone.BONE, key: '1' },
  { value: 500, tone: ChipTone.SLATE, key: '2' },
  { value: 2_500, tone: ChipTone.SAGE, key: '3' },
  { value: 10_000, tone: ChipTone.OXBLOOD, key: '4' },
  { value: 50_000, tone: ChipTone.CHAMPAGNE, key: '5' },
];

export const TIMING = {
  /** Full landing plan from "outcome received" to the ball at rest. */
  landingMs: 5_200,
  landingReducedMs: 1_800,
  /** How long a settled result stays on the felt before the next round opens. */
  resultHoldMs: 3_400,
} as const;

export const HISTORY_LENGTH = 60;

export const MOCK_DEFAULTS = {
  seed: 'house-seed',
  latencyMin: 280,
  latencyMax: 720,
  errorRate: 0,
} as const;
