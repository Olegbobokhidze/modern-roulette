/**
 * Subtle synthesised sound (no audio files). The AudioContext is created lazily on the first user
 * gesture; every call is a safe no-op if audio is unavailable or blocked. Mute persists in
 * localStorage, guarded because private modes can throw.
 */
import { SOUND } from '../config/sound';

const STORAGE_KEY = 'modern-roulette:muted';

function readMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private roll: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private muted = readMuted();
  private visible = true;
  private readonly listeners = new Set<() => void>();

  isMuted = (): boolean => this.muted;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* storage unavailable: keep the in-memory value */
    }
    this.applyGain();
    for (const l of this.listeners) l();
  }

  setPageVisible(visible: boolean): void {
    this.visible = visible;
    if (!this.ctx) return;
    void (visible ? this.ctx.resume() : this.ctx.suspend()).catch(() => {});
  }

  /** Call from a user gesture. Idempotent. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.applyGain();
        const len = Math.floor(this.ctx.sampleRate * 1.5);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        let seed = 1234567;
        for (let i = 0; i < len; i++) {
          seed = (seed * 16807) % 2147483647;
          data[i] = (seed / 2147483647) * 2 - 1;
        }
      }
      if (this.ctx.state === 'suspended' && this.visible) void this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  // ------------------------------------------------------------------ cues

  chip(remove = false): void {
    const r = remove ? SOUND.chipRemove : SOUND.chip;
    this.click(r.freq, r.q, r.decay, r.gain);
  }

  tick(strength: number): void {
    this.click(SOUND.tick.freq * (0.9 + 0.2 * strength), SOUND.tick.q, SOUND.tick.decay, SOUND.tick.gain * strength);
  }

  land(): void {
    this.click(SOUND.land.freq, SOUND.land.q, SOUND.land.decay, SOUND.land.gain);
  }

  launch(): void {
    this.run((ctx, out) => {
      const t = ctx.currentTime;
      const src = this.noiseSource(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2;
      bp.frequency.setValueAtTime(SOUND.launch.from, t);
      bp.frequency.exponentialRampToValueAtTime(SOUND.launch.to, t + SOUND.launch.dur);
      const g = this.env(ctx, t, SOUND.launch.gain, SOUND.launch.dur);
      src.connect(bp).connect(g).connect(out);
      src.start(t);
      src.stop(t + SOUND.launch.dur + 0.05);
    });
  }

  /** Continuous ball-on-rim roll; level 0 stops it. */
  setRoll(level: number): void {
    this.run((ctx, out) => {
      if (level <= 0.001) {
        if (this.roll) {
          const r = this.roll;
          this.roll = null;
          r.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
          r.src.stop(ctx.currentTime + 0.4);
        }
        return;
      }
      if (!this.roll) {
        const src = this.noiseSource(ctx);
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = SOUND.roll.lowpass;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = SOUND.roll.highpass;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(hp).connect(lp).connect(gain).connect(out);
        src.start();
        this.roll = { src, gain };
      }
      this.roll.gain.gain.setTargetAtTime(SOUND.roll.gain * level, ctx.currentTime, 0.05);
    });
  }

  win(big: boolean): void {
    const w = big ? SOUND.bigWin : SOUND.win;
    this.run((ctx, out) => {
      const t0 = ctx.currentTime + 0.02;
      w.notes.forEach((f, i) => {
        const t = t0 + i * w.spacing;
        for (const [mult, amp] of [
          [1, 1],
          [2.01, 0.25],
        ] as const) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = f * mult;
          const g = this.env(ctx, t, w.gain * amp, w.decay);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + w.decay + 0.05);
        }
      });
    });
  }

  error(): void {
    this.run((ctx, out) => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(SOUND.error.freq, t);
      o.frequency.exponentialRampToValueAtTime(SOUND.error.freq * 0.8, t + SOUND.error.dur);
      const g = this.env(ctx, t, SOUND.error.gain, SOUND.error.dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + SOUND.error.dur + 0.05);
    });
  }

  // ------------------------------------------------------------------ internals

  private run(fn: (ctx: AudioContext, out: AudioNode) => void): void {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out || ctx.state !== 'running') return;
    try {
      fn(ctx, out);
    } catch {
      /* audio must never break the game */
    }
  }

  private click(freq: number, q: number, decay: number, gain: number): void {
    this.run((ctx, out) => {
      const t = ctx.currentTime;
      const src = this.noiseSource(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = q;
      const g = this.env(ctx, t, gain, decay);
      src.connect(bp).connect(g).connect(out);
      src.start(t, Math.random() * 1.2);
      src.stop(t + decay + 0.03);
    });
  }

  private noiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    return s;
  }

  private env(ctx: AudioContext, t: number, peak: number, decay: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    return g;
  }

  private applyGain(): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : SOUND.master, this.ctx.currentTime, 0.02);
  }
}
