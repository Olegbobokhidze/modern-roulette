/**
 * Deterministic angle → pocket resolver (ADR-0002). Angles are radians, clockwise, with 0 at 12
 * o'clock. Pocket i (WHEEL_ORDER[i]) is centred at wheel-frame angle i·ARC. The renderer's landing
 * planner uses the inverse (`pocketOffset`), and tests check that the two agree for every pocket.
 */
import { POCKET_COUNT, WHEEL_ORDER, pocketIndexOf } from '../config/wheel';

export const TAU = Math.PI * 2;
export const POCKET_ARC = TAU / POCKET_COUNT;

export function normalizeAngle(a: number): number {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
}

/** Wrap to [-π, π). */
export function wrapPi(a: number): number {
  return normalizeAngle(a + Math.PI) - Math.PI;
}

/** Wheel-frame angle of a number's pocket centre. */
export function pocketOffset(n: number): number {
  return pocketIndexOf(n) * POCKET_ARC;
}

/** Which pocket the ball is over, given absolute wheel and ball angles. */
export function pocketAt(wheelAngle: number, ballAngle: number): { readonly index: number; readonly number: number } {
  const rel = normalizeAngle(ballAngle - wheelAngle);
  const index = Math.round(rel / POCKET_ARC) % POCKET_COUNT;
  return { index, number: WHEEL_ORDER[index] ?? 0 };
}
