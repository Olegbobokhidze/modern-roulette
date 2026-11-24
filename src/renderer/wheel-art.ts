/**
 * Static wheel art, painted once per size into offscreen canvases (ADR-0002). The bowl does not move.
 * The rotor (number ring, pockets, cone, turret) is drawn each frame as one rotated drawImage, so a
 * frame costs a few draw calls regardless of DPR.
 *
 * Angle convention: 0 at 12 o'clock, clockwise. Canvas arcs use 0 at 3 o'clock, hence `- QUARTER`.
 */
import { WHEEL_RADII as RR, WHEEL_THEME as C } from '../config/theme';
import { WHEEL_ORDER, colorOf } from '../config/wheel';
import { POCKET_ARC, TAU } from '../engine/resolver';

const QUARTER = Math.PI / 2;
export const WHEEL_FONT = '"Inter", "Helvetica Neue", Arial, sans-serif';

function makeCanvas(px: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  return [c, g];
}

function sector(g: CanvasRenderingContext2D, r0: number, r1: number, a0: number, a1: number): void {
  g.beginPath();
  g.arc(0, 0, r1, a0 - QUARTER, a1 - QUARTER);
  g.arc(0, 0, r0, a1 - QUARTER, a0 - QUARTER, true);
  g.closePath();
}

function ring(g: CanvasRenderingContext2D, r: number, stroke: string, width: number): void {
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.strokeStyle = stroke;
  g.lineWidth = width;
  g.stroke();
}

const fill = (n: number) => (colorOf(n) === 'red' ? C.red : colorOf(n) === 'black' ? C.black : C.green);

/** Darken a #RRGGBB colour by `k` (0..1). */
function shade(hex: string, k: number): string {
  const v = parseInt(hex.slice(1), 16);
  const f = (x: number) => Math.round(x * (1 - k));
  return `rgb(${f((v >> 16) & 255)}, ${f((v >> 8) & 255)}, ${f(v & 255)})`;
}

export type WheelArt = { readonly bowl: HTMLCanvasElement; readonly rotor: HTMLCanvasElement; readonly px: number };

/** `px` is the square device-pixel size; the wheel radius is px / 2. */
export function paintWheel(px: number): WheelArt {
  return { bowl: paintBowl(px), rotor: paintRotor(px), px };
}

function paintBowl(px: number): HTMLCanvasElement {
  const [c, g] = makeCanvas(px);
  const R = px / 2;
  const hair = Math.max(1, px / 900);
  g.translate(R, R);

  // Outer rim: a matte, near-black lacquer with one champagne hairline.
  const rim = g.createRadialGradient(0, 0, R * 0.8, 0, 0, R);
  rim.addColorStop(0, C.bowl);
  rim.addColorStop(0.92, C.bowlEdge);
  rim.addColorStop(1, '#0B0B0C');
  g.beginPath();
  g.arc(0, 0, R * RR.outer, 0, TAU);
  g.fillStyle = rim;
  g.fill();
  ring(g, R * 0.985, 'rgba(200, 179, 138, 0.35)', hair);

  // Ball track: a shallow sheen that suggests the inclined wall.
  const track = g.createRadialGradient(0, 0, R * RR.trackInner, 0, 0, R * RR.trackOuter);
  track.addColorStop(0, '#111112');
  track.addColorStop(0.55, C.trackSheen);
  track.addColorStop(1, C.track);
  g.beginPath();
  g.arc(0, 0, R * RR.trackOuter, 0, TAU);
  g.arc(0, 0, R * RR.trackInner, 0, TAU, true);
  g.fillStyle = track;
  g.fill();
  ring(g, R * RR.trackOuter, C.hairline, hair);
  ring(g, R * RR.trackInner, C.hairline, hair);

  // Lower bowl that the rotor sits in, with a soft contact shadow under the rotor edge.
  const well = g.createRadialGradient(0, 0, R * RR.numbersOuter * 0.97, 0, 0, R * RR.trackInner);
  well.addColorStop(0, 'rgba(0,0,0,0.65)');
  well.addColorStop(1, '#141415');
  g.beginPath();
  g.arc(0, 0, R * RR.trackInner, 0, TAU);
  g.fillStyle = well;
  g.fill();

  // Eight deflectors, alternating radial and tangential, as on a real bowl.
  for (let i = 0; i < 8; i++) {
    g.save();
    g.rotate((i / 8) * TAU + POCKET_ARC / 2);
    g.translate(0, -R * RR.deflector);
    if (i % 2) g.rotate(QUARTER);
    const L = R * 0.034;
    const W = R * 0.011;
    const grad = g.createLinearGradient(-W, 0, W, 0);
    grad.addColorStop(0, C.champagneDark);
    grad.addColorStop(0.5, C.champagneLight);
    grad.addColorStop(1, C.champagneDark);
    g.beginPath();
    g.moveTo(0, -L);
    g.lineTo(W, 0);
    g.lineTo(0, L);
    g.lineTo(-W, 0);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
    g.restore();
  }

  // A faint top-left reflection on the lacquer, painted once.
  const sheen = g.createLinearGradient(-R, -R, R * 0.2, R * 0.2);
  sheen.addColorStop(0, 'rgba(236,230,218,0.05)');
  sheen.addColorStop(1, 'rgba(236,230,218,0)');
  g.beginPath();
  g.arc(0, 0, R * 0.995, 0, TAU);
  g.arc(0, 0, R * RR.trackOuter, 0, TAU, true);
  g.fillStyle = sheen;
  g.fill();
  return c;
}

function paintRotor(px: number): HTMLCanvasElement {
  const [c, g] = makeCanvas(px);
  const R = px / 2;
  const hair = Math.max(1, px / 900);
  g.translate(R, R);

  for (let i = 0; i < WHEEL_ORDER.length; i++) {
    const n = WHEEL_ORDER[i] ?? 0;
    const a0 = (i - 0.5) * POCKET_ARC;
    const a1 = (i + 0.5) * POCKET_ARC;
    // Number band
    sector(g, R * RR.numbersInner, R * RR.numbersOuter, a0, a1);
    g.fillStyle = fill(n);
    g.fill();
    // Pocket floor: deeper shade with a slight radial falloff
    sector(g, R * RR.pocketInner, R * RR.pocketOuter, a0, a1);
    const pg = g.createRadialGradient(0, 0, R * RR.pocketInner, 0, 0, R * RR.pocketOuter);
    pg.addColorStop(0, shade(fill(n), 0.55));
    pg.addColorStop(1, shade(fill(n), 0.3));
    g.fillStyle = pg;
    g.fill();
  }

  // Frets between pockets: fine brass dividers.
  g.strokeStyle = C.fret;
  g.lineWidth = Math.max(1, px / 520);
  g.globalAlpha = 0.75;
  for (let i = 0; i < WHEEL_ORDER.length; i++) {
    const a = (i + 0.5) * POCKET_ARC - QUARTER;
    g.beginPath();
    g.moveTo(Math.cos(a) * R * RR.pocketInner, Math.sin(a) * R * RR.pocketInner);
    g.lineTo(Math.cos(a) * R * RR.numbersOuter, Math.sin(a) * R * RR.numbersOuter);
    g.stroke();
  }
  g.globalAlpha = 1;
  ring(g, R * RR.pocketOuter, 'rgba(185, 164, 124, 0.55)', hair);
  ring(g, R * RR.numbersOuter, 'rgba(185, 164, 124, 0.7)', hair * 1.2);
  ring(g, R * RR.pocketInner, 'rgba(185, 164, 124, 0.45)', hair);

  // Numerals: upright toward the rim, in tabular figures.
  g.fillStyle = C.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `500 ${Math.round(R * 0.056)}px ${WHEEL_FONT}`;
  const rText = R * (RR.numbersInner + RR.numbersOuter) * 0.5;
  for (let i = 0; i < WHEEL_ORDER.length; i++) {
    g.save();
    g.rotate(i * POCKET_ARC);
    g.translate(0, -rText);
    g.fillText(String(WHEEL_ORDER[i]), 0, 0);
    g.restore();
  }

  // Cone: a graphite dish with a few machined rings.
  const cone = g.createRadialGradient(-R * 0.08, -R * 0.1, R * 0.05, 0, 0, R * RR.cone);
  cone.addColorStop(0, '#2A2A2E');
  cone.addColorStop(0.6, C.cone);
  cone.addColorStop(1, '#101011');
  g.beginPath();
  g.arc(0, 0, R * RR.cone, 0, TAU);
  g.fillStyle = cone;
  g.fill();
  for (const k of [0.46, 0.36, 0.26]) ring(g, R * k, 'rgba(236,230,218,0.05)', hair);

  // Turret: four slender arms and a hub in brushed champagne.
  for (let i = 0; i < 4; i++) {
    g.save();
    g.rotate((i / 4) * TAU + POCKET_ARC / 2);
    const len = R * 0.4;
    const w = R * 0.012;
    const arm = g.createLinearGradient(-w, 0, w, 0);
    arm.addColorStop(0, C.champagneDark);
    arm.addColorStop(0.5, C.champagneLight);
    arm.addColorStop(1, C.champagneDark);
    g.beginPath();
    g.moveTo(-w, 0);
    g.lineTo(-w * 0.45, -len);
    g.lineTo(w * 0.45, -len);
    g.lineTo(w, 0);
    g.closePath();
    g.fillStyle = arm;
    g.fill();
    g.beginPath();
    g.arc(0, -len, w * 1.3, 0, TAU);
    g.fillStyle = C.champagne;
    g.fill();
    g.restore();
  }
  const hub = g.createRadialGradient(-R * 0.03, -R * 0.035, R * 0.005, 0, 0, R * RR.turret * 0.6);
  hub.addColorStop(0, C.champagneLight);
  hub.addColorStop(0.6, C.champagne);
  hub.addColorStop(1, C.champagneDark);
  g.beginPath();
  g.arc(0, 0, R * RR.turret * 0.6, 0, TAU);
  g.fillStyle = hub;
  g.fill();
  ring(g, R * RR.turret * 0.6, 'rgba(0,0,0,0.35)', hair);
  return c;
}
