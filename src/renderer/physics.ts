/**
 * Dual-motion wheel and ball kinematics (ADR-0002). Everything is a pure function of state and time, so
 * it can be unit-tested headless and replayed frame-for-frame.
 *
 *  - Free run ("no more bets", outcome unknown): the wheel eases up to spin speed clockwise, while the
 *    ball is launched counter-clockwise on the rim and loses speed to exponential friction.
 *  - Landing (outcome known): planned from whatever the current state is, so there is no visual jump.
 *      wheel:  ω(t) = ω_idle + (ω₀ − ω_idle)·e^(−kt)
 *      ball:   φ(t) = ball − wheel (relative angle) follows a cubic Hermite curve from (φ₀, φ̇₀) to
 *              (pocket centre + 2πm, 0). m is chosen next to the constant-deceleration travel φ̇₀·T/2,
 *              so the curve stays monotonic and reads as natural friction.
 *      drop:   past `dropStart` the ball leaves the rim, scatters on the deflectors (jitter windowed to
 *              zero at the seat) and lands in the pocket.
 *      settle: a damped rattle smaller than half a pocket, so the resolved pocket never changes.
 */
import { WHEEL_RADII } from '../config/theme';
import { POCKET_ARC, pocketOffset, wrapPi } from '../engine/resolver';

export const MOTION = {
  wheelIdle: 0.3,
  wheelSpin: 1.5,
  wheelAccel: 1.4,
  wheelDecay: 0.38,
  wheelIdleReturn: 0.7,
  ballLaunch: -11.5,
  ballFriction: 0.05,
  lift: 6.5,
  landFraction: 0.8,
  dropStart: 0.58,
  dropBump: 0.045,
  dropJitter: 0.13,
  settleAmp: 0.045,
  settleDecay: 0.22,
  settleFreq: 3.1,
  hop: 0.03,
  fadeRate: 5,
} as const;

export type Motion = {
  readonly wheelAngle: number;
  readonly wheelVel: number;
  readonly ballAngle: number;
  readonly ballVel: number;
  /** Fraction of the wheel radius. */
  readonly ballRadius: number;
  /** 0..1 */
  readonly ballAlpha: number;
};

export const initialMotion = (): Motion => ({
  wheelAngle: 0,
  wheelVel: MOTION.wheelIdle,
  ballAngle: Math.PI,
  ballVel: MOTION.wheelIdle,
  ballRadius: WHEEL_RADII.rim,
  ballAlpha: 0,
});

const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * (1 - Math.exp(-rate * dt));

/** Ball launched (or picked up from its pocket) and running free on the rim. */
export function stepFree(m: Motion, dt: number): Motion {
  const wheelVel = approach(m.wheelVel, MOTION.wheelSpin, MOTION.wheelAccel, dt);
  const ballVel = m.ballVel * Math.exp(-MOTION.ballFriction * dt);
  return {
    wheelAngle: m.wheelAngle + wheelVel * dt,
    wheelVel,
    ballAngle: m.ballAngle + ballVel * dt,
    ballVel,
    ballRadius: approach(m.ballRadius, WHEEL_RADII.rim, MOTION.lift, dt),
    ballAlpha: approach(m.ballAlpha, 1, MOTION.fadeRate * 2, dt),
  };
}

/** Wheel coasting back to idle. The ball either rides in its pocket (`seat` = relative angle) or fades out. */
export function stepIdle(m: Motion, dt: number, seat: number | null): Motion {
  const wheelVel = approach(m.wheelVel, MOTION.wheelIdle, MOTION.wheelIdleReturn, dt);
  const wheelAngle = m.wheelAngle + wheelVel * dt;
  if (seat !== null) {
    return { wheelAngle, wheelVel, ballAngle: wheelAngle + seat, ballVel: wheelVel, ballRadius: WHEEL_RADII.pocket, ballAlpha: 1 };
  }
  const ballVel = m.ballVel * Math.exp(-2 * dt);
  return {
    wheelAngle,
    wheelVel,
    ballAngle: m.ballAngle + ballVel * dt,
    ballVel,
    ballRadius: approach(m.ballRadius, WHEEL_RADII.trackOuter, 4, dt),
    ballAlpha: approach(m.ballAlpha, 0, MOTION.fadeRate, dt),
  };
}

/** Put a ball on the wheel: picked up from its pocket if seated, or dropped onto the rim if absent. */
export function launch(m: Motion): Motion {
  const absent = m.ballAlpha < 0.2;
  return {
    ...m,
    ballAngle: absent ? m.wheelAngle + Math.PI * 0.75 : m.ballAngle,
    ballVel: MOTION.ballLaunch,
    ballRadius: absent ? WHEEL_RADII.trackOuter : m.ballRadius,
    ballAlpha: absent ? 0 : m.ballAlpha,
  };
}

export type LandingPlan = {
  readonly target: number;
  readonly start: Motion;
  readonly duration: number;
  /** Seat time: the ball is in the pocket from here on. */
  readonly seatAt: number;
  readonly phi0: number;
  readonly v0: number;
  /** Total relative travel; φ(seatAt) = phi0 + travel ≡ pocketOffset(target). */
  readonly travel: number;
  readonly lively: boolean;
};

/**
 * Plan the rest of the spin so the ball settles in `target`. `duration` is in seconds; set `lively`
 * false for reduced motion (no scatter or rattle).
 */
export function planLanding(m: Motion, target: number, duration: number, lively = true): LandingPlan {
  const seatAt = duration * MOTION.landFraction;
  const phi0 = m.ballAngle - m.wheelAngle;
  // Guarantee a counter-rotating approach even if planning from an odd state.
  const v0 = Math.min(m.ballVel - m.wheelVel, -4);
  const nominal = (v0 * seatAt) / 2;
  const travel = nominal + wrapPi(pocketOffset(target) - (phi0 + nominal));
  return { target, start: { ...m, ballVel: m.wheelVel + v0 }, duration, seatAt, phi0, v0, travel, lively };
}

export type Sample = Motion & {
  /** Relative angle ball − wheel. */
  readonly phi: number;
  readonly seated: boolean;
  readonly done: boolean;
  /** 0 on the rim → 1 seated; useful for sound. */
  readonly drop: number;
};

function wheelAt(p: LandingPlan, t: number): { angle: number; vel: number } {
  const k = MOTION.wheelDecay;
  const w0 = p.start.wheelVel;
  const wi = MOTION.wheelIdle;
  const e = Math.exp(-k * t);
  return { angle: p.start.wheelAngle + wi * t + ((w0 - wi) * (1 - e)) / k, vel: wi + (w0 - wi) * e };
}

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

export function sampleLanding(p: LandingPlan, tIn: number): Sample {
  const t = Math.max(0, Math.min(tIn, p.duration));
  const w = wheelAt(p, t);
  const R = WHEEL_RADII;
  let phi: number;
  let dphi: number;
  let radius: number;
  let drop: number;

  if (t < p.seatAt) {
    const T = p.seatAt;
    const u = t / T;
    const h10 = u * u * u - 2 * u * u + u;
    const h01 = -2 * u * u * u + 3 * u * u;
    phi = p.phi0 + h10 * T * p.v0 + h01 * p.travel;
    dphi = ((3 * u * u - 4 * u + 1) * T * p.v0 + (6 * u - 6 * u * u) * p.travel) / T;
    // Rim radius, easing up from wherever the ball was when the plan began.
    const rimR = R.rim + (p.start.ballRadius - R.rim) * Math.exp(-MOTION.lift * t);
    if (u < MOTION.dropStart) {
      radius = rimR;
      drop = 0;
    } else {
      const s = (u - MOTION.dropStart) / (1 - MOTION.dropStart);
      drop = s;
      radius = rimR + (R.pocket - rimR) * easeInOutCubic(s);
      if (p.lively) {
        radius += MOTION.dropBump * Math.sin(Math.PI * 3 * s) ** 2 * (1 - s);
        const win = s * (1 - s) ** 2;
        phi += MOTION.dropJitter * win * Math.sin(2 * Math.PI * 2.5 * s);
      }
    }
  } else {
    const tau = t - p.seatAt;
    const decay = Math.exp(-tau / MOTION.settleDecay);
    const osc = 2 * Math.PI * MOTION.settleFreq;
    phi = p.phi0 + p.travel + (p.lively ? MOTION.settleAmp * decay * Math.sin(osc * tau) : 0);
    dphi = p.lively ? MOTION.settleAmp * decay * (osc * Math.cos(osc * tau) - Math.sin(osc * tau) / MOTION.settleDecay) : 0;
    radius = R.pocket + (p.lively ? MOTION.hop * Math.exp(-tau / 0.16) * Math.abs(Math.sin(2 * Math.PI * 2.6 * tau)) : 0);
    drop = 1;
  }

  return {
    wheelAngle: w.angle,
    wheelVel: w.vel,
    ballAngle: w.angle + phi,
    ballVel: w.vel + dphi,
    ballRadius: radius,
    ballAlpha: Math.min(1, p.start.ballAlpha + t * MOTION.fadeRate * 2),
    phi,
    seated: t >= p.seatAt,
    done: t >= p.duration,
    drop,
  };
}

/** Index of the fret (pocket divider) the relative angle has passed; a change means a "tick". */
export const fretIndex = (phi: number): number => Math.floor((phi + POCKET_ARC / 2) / POCKET_ARC);
