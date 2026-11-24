/**
 * WheelView implements the controller's WheelPort on a high-DPI Canvas 2D element (ADR-0002).
 * One requestAnimationFrame loop with clamped delta time drives the physics and draws a few layers:
 * the cached bowl, the rotated cached rotor, the result highlight and the ball. React never touches it
 * per frame.
 */
import { WHEEL_RADII as RR, WHEEL_THEME as C } from '../config/theme';
import type { WheelPort } from '../engine/controller';
import { POCKET_ARC, pocketAt, pocketOffset } from '../engine/resolver';
import { FrameStats, type FrameReport } from './frame-stats';
import {
  fretIndex,
  initialMotion,
  launch,
  planLanding,
  sampleLanding,
  stepFree,
  stepIdle,
  type LandingPlan,
  type Motion,
} from './physics';
import { paintWheel, type WheelArt } from './wheel-art';

export const WheelPhase = { IDLE: 'idle', FREE: 'free', LANDING: 'landing', SEATED: 'seated', LIFTED: 'lifted' } as const;
export type WheelPhase = (typeof WheelPhase)[keyof typeof WheelPhase];

export type WheelSound =
  | { readonly type: 'launch' }
  | { readonly type: 'tick'; readonly strength: number }
  | { readonly type: 'land' }
  /** 0..1: ball rolling on the rim, sent every frame while it changes. */
  | { readonly type: 'roll'; readonly level: number };

export type WheelViewOptions = {
  readonly reducedMotion: boolean;
  readonly landingMs: number;
  readonly onSound?: (e: WheelSound) => void;
};

export type WheelDebug = {
  readonly phase: WheelPhase;
  readonly underBall: number | null;
  readonly wheelVel: number;
  readonly ballVel: number;
  readonly frame: FrameReport;
};

const QUARTER = Math.PI / 2;
const MAX_DT = 1 / 20;

export class WheelView implements WheelPort {
  readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private readonly stats = new FrameStats();
  private art: WheelArt | null = null;
  private cssSize = 0;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private destroyed = false;

  private motion: Motion = initialMotion();
  private phase: WheelPhase = WheelPhase.IDLE;
  private plan: LandingPlan | null = null;
  private planT = 0;
  private seat: number | null = null;
  private landResolve: (() => void) | null = null;
  private lastFret = 0;
  private lastRoll = -1;
  private landed = false;
  private result: number | null = null;
  private resultT = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly opts: WheelViewOptions,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wheel__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    const g = this.canvas.getContext('2d');
    if (!g) throw new Error('2D canvas unavailable');
    this.g = g;
    host.appendChild(this.canvas);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    // Numerals use a web font: repaint the cached rotor once it has loaded.
    void document.fonts?.ready.then(() => {
      if (!this.destroyed) this.art = null;
    });
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ WheelPort

  launch(): void {
    this.settlePending();
    this.motion = launch(this.motion);
    this.phase = WheelPhase.FREE;
    this.seat = null;
    this.result = null;
    this.plan = null;
    this.opts.onSound?.({ type: 'launch' });
  }

  land(number: number): Promise<void> {
    if (this.phase !== WheelPhase.FREE) this.launch();
    this.settlePending();
    const ms = this.opts.reducedMotion ? Math.min(this.opts.landingMs, 1800) : this.opts.landingMs;
    this.plan = planLanding(this.motion, number, ms / 1000, !this.opts.reducedMotion);
    this.planT = 0;
    this.landed = false;
    this.lastFret = fretIndex(this.plan.phi0);
    this.phase = WheelPhase.LANDING;
    return new Promise<void>((resolve) => (this.landResolve = resolve));
  }

  abort(): void {
    this.settlePending();
    this.plan = null;
    this.seat = null;
    this.phase = WheelPhase.LIFTED;
  }

  showResult(number: number | null): void {
    this.result = number;
    this.resultT = 0;
  }

  // ------------------------------------------------------------------ public helpers

  debug(): WheelDebug {
    const m = this.motion;
    const visible = m.ballAlpha > 0.5 && (this.phase === WheelPhase.SEATED || this.phase === WheelPhase.LANDING);
    return {
      phase: this.phase,
      underBall: visible ? pocketAt(m.wheelAngle, m.ballAngle).number : null,
      wheelVel: m.wheelVel,
      ballVel: m.ballVel,
      frame: this.stats.report(),
    };
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.settlePending();
    this.canvas.remove();
  }

  // ------------------------------------------------------------------ loop

  private readonly frame = (now: number): void => {
    if (this.destroyed) return;
    const dtMs = this.last ? now - this.last : 16.7;
    this.last = now;
    this.stats.push(dtMs);
    this.update(Math.min(MAX_DT, dtMs / 1000));
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    switch (this.phase) {
      case WheelPhase.IDLE:
        this.motion = stepIdle(this.motion, dt, null);
        break;
      case WheelPhase.LIFTED:
        this.motion = stepIdle(this.motion, dt, null);
        if (this.motion.ballAlpha < 0.01) this.phase = WheelPhase.IDLE;
        break;
      case WheelPhase.SEATED:
        this.motion = stepIdle(this.motion, dt, this.seat);
        break;
      case WheelPhase.FREE:
        this.motion = stepFree(this.motion, dt);
        break;
      case WheelPhase.LANDING: {
        const p = this.plan;
        if (!p) break;
        this.planT += dt;
        const s = sampleLanding(p, this.planT);
        this.motion = s;
        if (s.drop > 0) {
          const f = fretIndex(s.phi);
          if (f !== this.lastFret) {
            this.lastFret = f;
            this.opts.onSound?.({ type: 'tick', strength: s.seated ? 0.35 : 0.6 + 0.4 * (1 - s.drop) });
          }
        }
        if (s.seated && !this.landed) {
          this.landed = true;
          this.opts.onSound?.({ type: 'land' });
        }
        if (s.done) {
          this.seat = pocketOffset(p.target);
          this.phase = WheelPhase.SEATED;
          this.plan = null;
          this.settlePending();
        }
        break;
      }
    }
    if (this.result !== null) this.resultT += dt;
    this.emitRoll();
  }

  private emitRoll(): void {
    const m = this.motion;
    const onRim = this.phase === WheelPhase.FREE || (this.phase === WheelPhase.LANDING && !this.landed);
    const level = onRim ? Math.min(1, Math.abs(m.ballVel - m.wheelVel) / 12) * m.ballAlpha : 0;
    const q = Math.round(level * 50) / 50;
    if (q !== this.lastRoll) {
      this.lastRoll = q;
      this.opts.onSound?.({ type: 'roll', level: q });
    }
  }

  private settlePending(): void {
    const r = this.landResolve;
    this.landResolve = null;
    r?.();
  }

  // ------------------------------------------------------------------ drawing

  private resize(): void {
    const rect = this.host.getBoundingClientRect();
    const size = Math.max(64, Math.floor(Math.min(rect.width, rect.height || rect.width)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (size === this.cssSize && dpr === this.dpr) return;
    this.cssSize = size;
    this.dpr = dpr;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = this.canvas.style.height = `${size}px`;
    this.art = null;
  }

  private draw(): void {
    const g = this.g;
    const px = this.canvas.width;
    if (!this.art || this.art.px !== px) this.art = paintWheel(px);
    const art = this.art;
    const R = px / 2;
    const m = this.motion;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, px, px);
    g.drawImage(art.bowl, 0, 0);

    g.save();
    g.translate(R, R);
    g.rotate(m.wheelAngle);
    g.drawImage(art.rotor, -R, -R);
    if (this.result !== null) this.drawHighlight(R);
    g.restore();

    if (m.ballAlpha > 0.01) this.drawBall(R, m);
  }

  private drawHighlight(R: number): void {
    if (this.result === null) return;
    const g = this.g;
    const a = pocketOffset(this.result);
    const a0 = a - POCKET_ARC / 2 - QUARTER;
    const a1 = a + POCKET_ARC / 2 - QUARTER;
    const appear = Math.min(1, this.resultT / 0.35);
    const pulse = 0.75 + 0.25 * Math.cos(this.resultT * 2.4);
    g.beginPath();
    g.arc(0, 0, R * RR.numbersOuter, a0, a1);
    g.arc(0, 0, R * RR.pocketInner, a1, a0, true);
    g.closePath();
    g.fillStyle = `rgba(231, 216, 182, ${0.14 * appear * pulse})`;
    g.fill();
    g.strokeStyle = `rgba(200, 179, 138, ${0.95 * appear})`;
    g.lineWidth = Math.max(1.5, R / 160);
    g.stroke();
    // A thin champagne tick on the outer rim marks the pocket from afar.
    g.beginPath();
    g.arc(0, 0, R * (RR.numbersOuter + 0.012), a0 + 0.01, a1 - 0.01);
    g.strokeStyle = `rgba(231, 216, 182, ${appear})`;
    g.lineWidth = Math.max(2, R / 90);
    g.stroke();
  }

  private drawBall(R: number, m: Motion): void {
    const g = this.g;
    const br = R * RR.ball;
    const pos = (angle: number, radius: number) => ({ x: R + Math.sin(angle) * radius * R, y: R - Math.cos(angle) * radius * R });

    // Motion trail: three faint ghosts behind a fast ball (cheap, and it reads as speed instead of strobing).
    const rel = Math.abs(m.ballVel);
    if (rel > 3) {
      for (let k = 3; k >= 1; k--) {
        const p = pos(m.ballAngle - m.ballVel * k * 0.011, m.ballRadius);
        g.beginPath();
        g.arc(p.x, p.y, br * (1 - k * 0.12), 0, Math.PI * 2);
        g.fillStyle = `rgba(242, 238, 230, ${(0.1 * m.ballAlpha * Math.min(1, (rel - 3) / 6)) / k})`;
        g.fill();
      }
    }

    const p = pos(m.ballAngle, m.ballRadius);
    // Contact shadow toward the wheel centre (light comes from above the table).
    const sx = R + (p.x - R) * 0.985;
    const sy = R + (p.y - R) * 0.985 + br * 0.35;
    g.beginPath();
    g.ellipse(sx, sy, br * 1.05, br * 0.8, 0, 0, Math.PI * 2);
    g.fillStyle = `rgba(0,0,0,${0.45 * m.ballAlpha})`;
    g.fill();

    const grad = g.createRadialGradient(p.x - br * 0.35, p.y - br * 0.4, br * 0.1, p.x, p.y, br);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.45, C.ball);
    grad.addColorStop(1, C.ballShade);
    g.globalAlpha = m.ballAlpha;
    g.beginPath();
    g.arc(p.x, p.y, br, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.fill();
    g.globalAlpha = 1;
  }
}
