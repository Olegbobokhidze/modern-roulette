/**
 * Betting-table geometry (ADR-0003). Every spot gets a rectangle on a unit grid. Landscape is
 * 14 × 5: the zero column, 12 number columns, then the 2:1 column bets, with three number rows,
 * the dozens row and the even-money row. Portrait is the same table turned a quarter-turn (5 × 14,
 * zero on top, 1·2·3 reading left to right), as on mobile tables. Inside bets other than straights
 * are small hotspots centred on the shared edge or corner of the numbers they cover.
 */
import type { BetKind } from '../config/bets';
import type { BetSpot } from '../engine/spots';

export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
export const Orientation = { LANDSCAPE: 'landscape', PORTRAIT: 'portrait' } as const;
export type Orientation = (typeof Orientation)[keyof typeof Orientation];

export const GRID: { readonly [O in Orientation]: { readonly cols: number; readonly rows: number } } = {
  landscape: { cols: 14, rows: 5 },
  portrait: { cols: 5, rows: 14 },
};

const HOT_KINDS: ReadonlySet<BetKind> = new Set<BetKind>(['split', 'street', 'trio', 'corner', 'firstFour', 'line']);
export const isHotspot = (spot: BetSpot): boolean => HOT_KINDS.has(spot.kind);

/** Landscape cell of a number 1..36: column c = 0..11, row y = 0 (top: 3, 6, …) .. 2 (bottom: 1, 4, …). */
export function numberCell(n: number): Rect {
  if (n === 0) return { x: 0, y: 0, w: 1, h: 3 };
  const c = Math.floor((n - 1) / 3);
  const r = (n - 1) % 3;
  return { x: 1 + c, y: 2 - r, w: 1, h: 1 };
}

const EVEN_MONEY_ORDER = ['low', 'even', 'red', 'black', 'odd', 'high'] as const;

/** Centre (landscape units) of an inside hotspot: the edge or corner shared by its numbers. */
export function hotspotCentre(spot: BetSpot): { x: number; y: number } {
  const ns = spot.numbers;
  const first = ns[0] ?? 0;
  switch (spot.kind) {
    case 'split': {
      const [a = 0, b = 0] = ns;
      if (a === 0) return { x: 1, y: 3.5 - b }; // 0|1 → y 2.5, 0|2 → 1.5, 0|3 → 0.5
      const ca = numberCell(a);
      if (b - a === 3) return { x: ca.x + 1, y: ca.y + 0.5 };
      return { x: ca.x + 0.5, y: ca.y }; // vertical: shared top edge of a (b sits above)
    }
    case 'street':
      return { x: numberCell(first).x + 0.5, y: 3 };
    case 'trio':
      return { x: 1, y: ns.includes(1) ? 2 : 1 };
    case 'corner': {
      const c = numberCell(first);
      return { x: c.x + 1, y: c.y };
    }
    case 'firstFour':
      return { x: 1, y: 3 };
    case 'line':
      return { x: numberCell(first).x + 1, y: 3 };
    default:
      return { x: 0, y: 0 };
  }
}

/** The spot's rectangle in landscape units. `hot` is the hotspot size in units (bigger for touch). */
export function landscapeRect(spot: BetSpot, hot = 0.34): Rect {
  switch (spot.kind) {
    case 'straight':
      return numberCell(spot.numbers[0] ?? 0);
    case 'dozen': {
      const k = Number(spot.id.split(':')[1]);
      return { x: 1 + 4 * (k - 1), y: 3, w: 4, h: 1 };
    }
    case 'column': {
      const k = Number(spot.id.split(':')[1]);
      return { x: 13, y: 3 - k, w: 1, h: 1 };
    }
    case 'red':
    case 'black':
    case 'even':
    case 'odd':
    case 'low':
    case 'high':
      return { x: 1 + 2 * EVEN_MONEY_ORDER.indexOf(spot.kind), y: 4, w: 2, h: 1 };
    default: {
      const c = hotspotCentre(spot);
      return { x: c.x - hot / 2, y: c.y - hot / 2, w: hot, h: hot };
    }
  }
}

/** Quarter-turn: landscape (x, y) → portrait (rows − y − h, x). */
export function orient(r: Rect, o: Orientation): Rect {
  if (o === 'landscape') return r;
  return { x: GRID.landscape.rows - (r.y + r.h), y: r.x, w: r.h, h: r.w };
}

export const spotRect = (spot: BetSpot, o: Orientation, hot?: number): Rect => orient(landscapeRect(spot, hot), o);

/** CSS percentage box for an absolutely positioned element. */
export function toPercent(r: Rect, o: Orientation): { left: string; top: string; width: string; height: string } {
  const g = GRID[o];
  const pc = (v: number, d: number) => `${((v / d) * 100).toFixed(4)}%`;
  return { left: pc(r.x, g.cols), top: pc(r.y, g.rows), width: pc(r.w, g.cols), height: pc(r.h, g.rows) };
}
