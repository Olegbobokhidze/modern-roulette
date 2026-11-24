/**
 * The complete set of betting spots on a single-zero layout (ADR-0003). Every spot is plain data:
 * an id, its kind and the numbers it covers. Payouts come from BET_KINDS, so the UI preview, the
 * settlement and the mock server all read the same table.
 *
 * Table numbering: column c = 0..11 and row r = 0 (bottom: 1, 4, …), 1, 2 (top: 3, 6, …) give
 * n = 3c + r + 1.
 */
import { BET_KINDS, BetKind, type BetKindSpec } from '../config/bets';
import { colorOf } from '../config/wheel';

export type SpotId = string;

export type BetSpot = {
  readonly id: SpotId;
  readonly kind: BetKind;
  readonly numbers: readonly number[];
  readonly label: string;
};

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const spot = (kind: BetKind, id: string, numbers: readonly number[], label: string): BetSpot => ({ id, kind, numbers, label });

function build(): BetSpot[] {
  const out: BetSpot[] = [];

  for (let n = 0; n <= 36; n++) out.push(spot(BetKind.STRAIGHT, `straight:${n}`, [n], `Straight ${n}`));

  // Splits: horizontal (n | n+3), vertical (n / n+1 inside a column), and the three zero splits.
  for (let n = 1; n <= 33; n++) out.push(spot(BetKind.SPLIT, `split:${n}-${n + 3}`, [n, n + 3], `Split ${n} · ${n + 3}`));
  for (let n = 1; n <= 36; n++) if (n % 3 !== 0) out.push(spot(BetKind.SPLIT, `split:${n}-${n + 1}`, [n, n + 1], `Split ${n} · ${n + 1}`));
  for (const k of [1, 2, 3]) out.push(spot(BetKind.SPLIT, `split:0-${k}`, [0, k], `Split 0 · ${k}`));

  for (let c = 0; c < 12; c++) {
    const s = 3 * c + 1;
    out.push(spot(BetKind.STREET, `street:${s}`, [s, s + 1, s + 2], `Street ${s}–${s + 2}`));
  }
  out.push(spot(BetKind.TRIO, 'trio:0-1-2', [0, 1, 2], 'Trio 0 · 1 · 2'));
  out.push(spot(BetKind.TRIO, 'trio:0-2-3', [0, 2, 3], 'Trio 0 · 2 · 3'));

  for (let c = 0; c < 11; c++) {
    for (const r of [0, 1]) {
      const n = 3 * c + r + 1;
      out.push(spot(BetKind.CORNER, `corner:${n}`, [n, n + 1, n + 3, n + 4], `Corner ${n} · ${n + 1} · ${n + 3} · ${n + 4}`));
    }
  }
  out.push(spot(BetKind.FIRST_FOUR, 'firstFour', [0, 1, 2, 3], 'First four 0–3'));

  for (let c = 0; c < 11; c++) {
    const s = 3 * c + 1;
    out.push(spot(BetKind.LINE, `line:${s}`, range(s, s + 5), `Six line ${s}–${s + 5}`));
  }

  for (const k of [1, 2, 3]) {
    out.push(spot(BetKind.DOZEN, `dozen:${k}`, range(12 * (k - 1) + 1, 12 * k), `${['1st', '2nd', '3rd'][k - 1]} dozen ${12 * (k - 1) + 1}–${12 * k}`));
  }
  for (const k of [1, 2, 3]) {
    out.push(spot(BetKind.COLUMN, `column:${k}`, range(1, 36).filter((n) => n % 3 === k % 3), `Column ${k}`));
  }

  const all = range(1, 36);
  out.push(spot(BetKind.RED, 'red', all.filter((n) => colorOf(n) === 'red'), 'Red'));
  out.push(spot(BetKind.BLACK, 'black', all.filter((n) => colorOf(n) === 'black'), 'Black'));
  out.push(spot(BetKind.EVEN, 'even', all.filter((n) => n % 2 === 0), 'Even'));
  out.push(spot(BetKind.ODD, 'odd', all.filter((n) => n % 2 === 1), 'Odd'));
  out.push(spot(BetKind.LOW, 'low', range(1, 18), '1 to 18'));
  out.push(spot(BetKind.HIGH, 'high', range(19, 36), '19 to 36'));
  return out;
}

export const SPOTS: readonly BetSpot[] = build();
const BY_ID = new Map<SpotId, BetSpot>(SPOTS.map((s) => [s.id, s]));

export function getSpot(id: SpotId): BetSpot | undefined {
  return BY_ID.get(id);
}

export function specOf(spot: BetSpot): BetKindSpec {
  return BET_KINDS[spot.kind];
}

export function spotWins(spot: BetSpot, n: number): boolean {
  return spot.numbers.includes(n);
}
