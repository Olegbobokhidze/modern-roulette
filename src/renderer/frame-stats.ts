/** Rolling frame-time statistics for the inspector (fixed-size ring buffer; allocation-free per frame). */
export type FrameReport = { readonly fps: number; readonly avgMs: number; readonly p95Ms: number; readonly maxMs: number; readonly samples: number };

export class FrameStats {
  private readonly buf: Float64Array;
  private n = 0;
  private i = 0;

  constructor(size = 120) {
    this.buf = new Float64Array(size);
  }

  push(ms: number): void {
    this.buf[this.i] = ms;
    this.i = (this.i + 1) % this.buf.length;
    this.n = Math.min(this.n + 1, this.buf.length);
  }

  report(): FrameReport {
    if (this.n === 0) return { fps: 0, avgMs: 0, p95Ms: 0, maxMs: 0, samples: 0 };
    const xs = Array.from(this.buf.subarray(0, this.n)).sort((a, b) => a - b);
    const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
    return {
      fps: avg > 0 ? 1000 / avg : 0,
      avgMs: avg,
      p95Ms: xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] ?? 0,
      maxMs: xs[xs.length - 1] ?? 0,
      samples: this.n,
    };
  }
}
