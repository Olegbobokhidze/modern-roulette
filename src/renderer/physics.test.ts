import { describe, expect, it } from 'vitest';
import { WHEEL_RADII } from '../config/theme';
import { pocketAt } from '../engine/resolver';
import { createRng } from '../engine/rng';
import { MOTION, initialMotion, launch, planLanding, sampleLanding, stepFree, stepIdle, type Motion } from './physics';

/** Run the free phase for `seconds` at 60 fps, like the renderer does while waiting for the server. */
function freeRun(m: Motion, seconds: number): Motion {
  let s = launch(m);
  for (let t = 0; t < seconds; t += 1 / 60) s = stepFree(s, 1 / 60);
  return s;
}

describe('landing planner', () => {
  it('always settles in the server number, from any free-run state, at any duration', () => {
    const rng = createRng(42);
    for (let i = 0; i < 400; i++) {
      const target = Math.floor(rng() * 37);
      const start = freeRun({ ...initialMotion(), wheelAngle: rng() * 100 }, 0.1 + rng() * 2.5);
      const p = planLanding(start, target, 1.8 + rng() * 4, rng() > 0.2);
      const end = sampleLanding(p, p.duration);
      expect(end.done).toBe(true);
      expect(pocketAt(end.wheelAngle, end.ballAngle).number).toBe(target);
    }
  });

  it('the ball stays in the winning pocket for the whole settle rattle', () => {
    const p = planLanding(freeRun(initialMotion(), 0.6), 26, 5.2);
    for (let t = p.seatAt; t <= p.duration; t += 1 / 120) {
      const s = sampleLanding(p, t);
      expect(pocketAt(s.wheelAngle, s.ballAngle).number).toBe(26);
      expect(s.ballRadius).toBeGreaterThanOrEqual(WHEEL_RADII.pocket - 1e-9);
    }
  });

  it('starts exactly where the free run left off (no visual jump)', () => {
    const start = freeRun(initialMotion(), 1);
    const p = planLanding(start, 7, 5);
    const s0 = sampleLanding(p, 0);
    expect(s0.wheelAngle).toBeCloseTo(start.wheelAngle, 9);
    expect(s0.ballAngle).toBeCloseTo(start.ballAngle, 9);
    expect(s0.ballVel).toBeCloseTo(start.ballVel, 6);
    expect(s0.ballRadius).toBeCloseTo(start.ballRadius, 9);
  });

  it('the ball keeps counter-rotating relative to the wheel until it seats', () => {
    const p = planLanding(freeRun(initialMotion(), 0.8), 0, 5.2, false);
    let prev = sampleLanding(p, 0).phi;
    for (let t = 1 / 60; t < p.seatAt; t += 1 / 60) {
      const s = sampleLanding(p, t);
      expect(s.phi).toBeLessThanOrEqual(prev + 1e-9);
      prev = s.phi;
    }
  });

  it('the wheel decelerates toward idle and never reverses', () => {
    const p = planLanding(freeRun(initialMotion(), 1.2), 3, 5.2);
    for (let t = 0; t <= p.duration; t += 0.1) {
      const v = sampleLanding(p, t).wheelVel;
      expect(v).toBeGreaterThanOrEqual(MOTION.wheelIdle - 1e-9);
      expect(v).toBeLessThanOrEqual(MOTION.wheelSpin + 1e-9);
    }
  });
});

describe('idle and free phases', () => {
  it('a seated ball rides with the wheel; an aborted ball fades out', () => {
    let m: Motion = { ...initialMotion(), ballAlpha: 1 };
    for (let i = 0; i < 120; i++) m = stepIdle(m, 1 / 60, 0.5);
    expect(m.ballAngle - m.wheelAngle).toBeCloseTo(0.5, 9);
    for (let i = 0; i < 120; i++) m = stepIdle(m, 1 / 60, null);
    expect(m.ballAlpha).toBeLessThan(0.01);
  });

  it('launch counter-rotates the ball and the wheel spins up', () => {
    const m = freeRun(initialMotion(), 1.5);
    expect(m.ballVel).toBeLessThan(-8);
    expect(m.wheelVel).toBeGreaterThan(1);
    expect(m.ballRadius).toBeCloseTo(WHEEL_RADII.rim, 2);
  });
});
