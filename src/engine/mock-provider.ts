/**
 * In-memory table server (ADR-0004). It holds the wallet, validates bets server-side, decides the number
 * from (seed, roundId), settles with the same payout table as the client, and simulates latency and
 * failures. Time and randomness are injected, so tests are instant and deterministic.
 */
import { settle, totalStake } from './payout';
import { providerError, type OutcomeProvider, type SpinOutcome, type SpinRequest, type SpinResponse } from './provider';
import { numberFor, seedFingerprint } from './rng';
import { RejectReason, validateBets } from './slip';

export const FailureMode = { NONE: 'none', NETWORK: 'network', TIMEOUT: 'timeout', FUNDS: 'funds' } as const;
export type FailureMode = (typeof FailureMode)[keyof typeof FailureMode];

export type MockSettings = {
  readonly seed: string;
  readonly latencyMin: number;
  readonly latencyMax: number;
  /** Probability (0..1) of a random NETWORK failure on any spin. */
  readonly errorRate: number;
  /** One-shot failure for the next spin; resets to NONE once used. */
  readonly nextFailure: FailureMode;
  /** QA override: every spin lands on this number until cleared. */
  readonly forceNumber: number | null;
};

export type MockDeps = {
  readonly delay: (ms: number) => Promise<void>;
  readonly now: () => number;
  readonly random: () => number;
  readonly startingBalance: number;
  readonly settings: Omit<MockSettings, 'nextFailure' | 'forceNumber'> & Partial<Pick<MockSettings, 'nextFailure' | 'forceNumber'>>;
};

export class MockProvider implements OutcomeProvider {
  readonly name = 'MockProvider';
  private balance: number;
  private settings: MockSettings;
  private readonly committed = new Map<string, SpinOutcome>();
  private readonly listeners = new Set<() => void>();
  private spins = 0;

  constructor(private readonly deps: MockDeps) {
    this.balance = deps.startingBalance;
    this.settings = { nextFailure: FailureMode.NONE, forceNumber: null, ...deps.settings };
  }

  getSettings = (): MockSettings => this.settings;
  getStats = (): { readonly spins: number; readonly committed: number; readonly balance: number } => ({
    spins: this.spins,
    committed: this.committed.size,
    balance: this.balance,
  });

  update(patch: Partial<MockSettings>): void {
    this.settings = { ...this.settings, ...patch };
    if (this.settings.latencyMax < this.settings.latencyMin) this.settings = { ...this.settings, latencyMax: this.settings.latencyMin };
    this.emit();
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  async getBalance(): Promise<number> {
    await this.deps.delay(this.latency() * 0.4);
    return this.balance;
  }

  async spin(req: SpinRequest): Promise<SpinResponse> {
    this.spins++;
    const s = this.settings;
    let failure: FailureMode = s.nextFailure;
    if (failure !== FailureMode.NONE) this.update({ nextFailure: FailureMode.NONE });
    else if (this.deps.random() < s.errorRate) failure = FailureMode.NETWORK;

    await this.deps.delay(this.latency());

    // Idempotent replay: a retried roundId gets the already-committed result, never a second charge.
    const done = this.committed.get(req.roundId);
    if (done) return { ok: true, outcome: { ...done, replayed: true } };

    if (failure === FailureMode.NETWORK) return { ok: false, error: providerError('NETWORK') };
    if (failure === FailureMode.FUNDS) return { ok: false, error: providerError('INSUFFICIENT_FUNDS') };

    const invalid = validateBets(req.bets, this.balance);
    if (invalid) {
      const code = invalid.reason === RejectReason.INSUFFICIENT_FUNDS ? 'INSUFFICIENT_FUNDS' : 'INVALID_BET';
      return { ok: false, error: providerError(code, invalid.message) };
    }
    if (totalStake(req.bets) <= 0) return { ok: false, error: providerError('INVALID_BET', 'No bets on the table.') };

    const number = s.forceNumber ?? numberFor(s.seed, req.roundId);
    const settlement = settle(req.bets, number);
    const before = this.balance;
    this.balance = before + settlement.net;
    const outcome: SpinOutcome = {
      roundId: req.roundId,
      number,
      settlement,
      balanceBefore: before,
      balanceAfter: this.balance,
      seedFingerprint: seedFingerprint(s.seed),
      committedAt: this.deps.now(),
      replayed: false,
    };
    this.committed.set(req.roundId, outcome);
    this.emit();

    // TIMEOUT: committed on the server, but the response is "lost" on the way back.
    if (failure === FailureMode.TIMEOUT) return { ok: false, error: providerError('TIMEOUT') };
    return { ok: true, outcome };
  }

  private latency(): number {
    const { latencyMin: a, latencyMax: b } = this.settings;
    return Math.round(a + (b - a) * this.deps.random());
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
