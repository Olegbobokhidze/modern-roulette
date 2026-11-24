import { describe, expect, it } from 'vitest';
import { SPOTS, getSpot } from '../engine/spots';
import { GRID, hotspotCentre, isHotspot, numberCell, spotRect, type Orientation, type Rect } from './table-geometry';

const inside = (r: Rect, o: Orientation) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= GRID[o].cols + 1e-9 && r.y + r.h <= GRID[o].rows + 1e-9;
const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const near = (p: { x: number; y: number }, r: Rect, slack: number) =>
  p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;

describe('table geometry', () => {
  it('every spot lies inside the table in both orientations', () => {
    for (const o of ['landscape', 'portrait'] as const) for (const s of SPOTS) expect(inside(spotRect(s, o), o), `${s.id} ${o}`).toBe(true);
  });

  it('number cells tile the number area without overlap', () => {
    const seen = new Set<string>();
    for (let n = 1; n <= 36; n++) {
      const c = numberCell(n);
      const key = `${c.x},${c.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(numberCell(1)).toEqual({ x: 1, y: 2, w: 1, h: 1 });
    expect(numberCell(36)).toEqual({ x: 12, y: 0, w: 1, h: 1 });
  });

  it('each inside hotspot touches every number it covers, and only those', () => {
    // Street, six-line and first-four sit by convention on the bottom edge and cover the cells above them.
    const edgeBets = new Set(['street', 'line', 'firstFour']);
    for (const s of SPOTS.filter((x) => isHotspot(x) && !edgeBets.has(x.kind))) {
      const p = hotspotCentre(s);
      for (let n = 0; n <= 36; n++) expect(near(p, numberCell(n), 1e-9), `${s.id} vs ${n}`).toBe(s.numbers.includes(n));
    }
    for (const s of SPOTS.filter((x) => edgeBets.has(x.kind))) {
      expect(hotspotCentre(s).y, s.id).toBe(3);
      for (const n of s.numbers) expect(Math.abs(hotspotCentre(s).x - (numberCell(n).x + 0.5)) <= 1, `${s.id} spans ${n}`).toBe(true);
    }
  });

  it('no two inside hotspots share a centre', () => {
    const keys = SPOTS.filter(isHotspot).map((s) => JSON.stringify(hotspotCentre(s)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('portrait reads 1 · 2 · 3 left to right with zero on top', () => {
    const at = (id: string) => centre(spotRect(getSpot(id)!, 'portrait'));
    expect(at('straight:0').y).toBeLessThan(at('straight:1').y);
    expect(at('straight:1').x).toBeLessThan(at('straight:2').x);
    expect(at('straight:2').x).toBeLessThan(at('straight:3').x);
    expect(at('straight:1').y).toBeLessThan(at('straight:4').y);
    expect(at('dozen:1').x).toBeLessThan(at('straight:1').x); // outside bets on the left
  });
});
