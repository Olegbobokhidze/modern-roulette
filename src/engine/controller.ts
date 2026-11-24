/**
 * RouletteController: the one place where the round machine, the bet slip, the provider and the
 * wheel port meet (ADR-0001, ADR-0002). It has no framework and no DOM. Time comes from the
 * injected Clock. The UI reads `getSnapshot()` via `useSyncExternalStore` and only sends intents.
 */
import { HISTORY_LENGTH } from '../config/game';
import { colorOf, type PocketColor } from '../config/wheel';
import { isFeltOpen, RoundEvent, RoundState, step } from './machine';
import { totalStake, type Bets, type Settlement } from './payout';
import { providerError, type OutcomeProvider, type ProviderError, type SpinOutcome, type SpinResponse } from './provider';
import * as slipOps from './slip';
import type { SpotId } from './spots';

/** What the controller needs from a wheel. The renderer implements it; tests can omit it. */
export type WheelPort = {
  /** "No more bets": the wheel speeds up and the ball is launched. The number is still unknown. */
  launch(): void;
  /** The outcome is known: plan the remaining motion so the ball settles in `number`. */
  land(number: number): Promise<void>;
  /** The round failed: lift the ball and let the wheel coast. */
  abort(): void;
  showResult(number: number | null): void;
};

export type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export const LogKind = { TRANSITION: 'transition', REJECTED: 'rejected', PROVIDER: 'provider', STALE: 'stale' } as const;
export type LogKind = (typeof LogKind)[keyof typeof LogKind];

export type LogEntry = {
  readonly id: number;
  readonly t: number;
  readonly kind: LogKind;
  readonly event: string;
  readonly from?: RoundState;
  readonly to?: RoundState;
  readonly detail?: string;
};

export type Notice = { readonly id: number; readonly text: string; readonly tone: 'info' | 'warn' };

export type RoundResult = {
  readonly roundId: string;
  readonly number: number;
  readonly color: PocketColor;
  readonly settlement: Settlement;
  readonly balanceAfter: number;
};

export type ControllerEvent =
  | { readonly type: 'placed'; readonly spotId: SpotId }
  | { readonly type: 'removed' }
  | { readonly type: 'rejected'; readonly text: string }
  | { readonly type: 'state'; readonly from: RoundState; readonly to: RoundState }
  | { readonly type: 'result'; readonly result: RoundResult }
  | { readonly type: 'error'; readonly error: ProviderError };

export type Snapshot = {
  readonly state: RoundState;
  readonly bets: Bets;
  readonly staked: number;
  /** Confirmed wallet balance (server truth) minus any stake currently held by an open round. */
  readonly balance: number;
  /** What can still be placed this round. */
  readonly available: number;
  readonly roundId: string | null;
  readonly roundNo: number;
  readonly lastResult: RoundResult | null;
  readonly lastOutcome: SpinOutcome | null;
  readonly history: readonly number[];
  readonly error: ProviderError | null;
  readonly notice: Notice | null;
  readonly log: readonly LogEntry[];
  readonly canUndo: boolean;
  readonly canClear: boolean;
  readonly canRebet: boolean;
  readonly canDouble: boolean;
  readonly canSpin: boolean;
};

export type ControllerDeps = {
  readonly provider: OutcomeProvider;
  readonly clock: Clock;
  readonly startingBalance: number;
  readonly resultHoldMs: number;
  /** Prefix for round ids, so ids stay unique across reloads against a real server. */
  readonly sessionId?: string;
};

const LOG_LIMIT = 200;

export class RouletteController {
  private state: RoundState = RoundState.BETTING;
  private slip: slipOps.Slip = slipOps.emptySlip();
  private wallet: number;
  private roundNo = 0;
  private roundId: string | null = null;
  private pending: SpinOutcome | null = null;
  private lastResult: RoundResult | null = null;
  private lastOutcome: SpinOutcome | null = null;
  private history: number[] = [];
  private error: ProviderError | null = null;
  private notice: Notice | null = null;
  private log: LogEntry[] = [];
  private seq = 0;
  private holdTimer: unknown = null;
  private wheel: WheelPort | null = null;
  private disposed = false;
  private snapshot: Snapshot;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<(e: ControllerEvent) => void>();

  constructor(private readonly deps: ControllerDeps) {
    this.wallet = deps.startingBalance;
    this.snapshot = this.build();
  }

  // ------------------------------------------------------------------ store

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = (): Snapshot => this.snapshot;

  on(l: (e: ControllerEvent) => void): () => void {
    this.eventListeners.add(l);
    return () => this.eventListeners.delete(l);
  }

  attachWheel(wheel: WheelPort | null): void {
    this.wheel = wheel;
  }

  destroy(): void {
    this.disposed = true;
    if (this.holdTimer !== null) this.deps.clock.clearTimeout(this.holdTimer);
    this.listeners.clear();
    this.eventListeners.clear();
  }

  // ------------------------------------------------------------------ betting intents

  place(spotId: SpotId, amount: number): void {
    if (!this.openFelt('PLACE')) return;
    const r = slipOps.place(this.slip, spotId, amount, this.wallet);
    if (this.applySlip('PLACE', r)) {
      if (r.ok && r.capped) this.say('Capped at the table limit', 'info');
      this.fire({ type: 'placed', spotId });
      this.emit();
    }
  }

  remove(spotId: SpotId): void {
    if (!this.openFelt('REMOVE')) return;
    if (this.applySlip('REMOVE', slipOps.remove(this.slip, spotId))) {
      this.fire({ type: 'removed' });
      this.emit();
    }
  }

  undo(): void {
    if (this.state !== RoundState.BETTING) return this.rejectIntent('UNDO', 'Nothing to undo');
    if (this.applySlip('UNDO', slipOps.undo(this.slip))) {
      this.fire({ type: 'removed' });
      this.emit();
    }
  }

  clear(): void {
    if (this.state !== RoundState.BETTING) return this.rejectIntent('CLEAR', 'The table is already clear');
    if (this.applySlip('CLEAR', slipOps.clear(this.slip))) {
      this.fire({ type: 'removed' });
      this.emit();
    }
  }

  rebet(): void {
    if (!this.openFelt('REBET')) return;
    if (this.applySlip('REBET', slipOps.rebet(this.slip, this.wallet))) {
      this.fire({ type: 'placed', spotId: 'rebet' });
      this.emit();
    }
  }

  double(): void {
    if (this.state !== RoundState.BETTING) return this.rejectIntent('DOUBLE', 'Place a bet to double');
    if (this.applySlip('DOUBLE', slipOps.double(this.slip, this.wallet))) {
      this.fire({ type: 'placed', spotId: 'double' });
      this.emit();
    }
  }

  // ------------------------------------------------------------------ round intents

  /** Spin. From RESULT it means "spin again": the round closes and the same bets go back on. */
  spin(): void {
    if (this.state === RoundState.RESULT) {
      this.nextRound();
      if (Object.keys(this.slip.bets).length === 0 && this.slip.lastRound) {
        const r = slipOps.rebet(this.slip, this.wallet);
        if (!r.ok) return this.rejectIntent('SPIN', r.message);
        this.slip = r.slip;
      }
    }
    if (this.state !== RoundState.BETTING) return this.rejectIntent('SPIN', 'The wheel is already in motion');
    const staked = totalStake(this.slip.bets);
    if (staked <= 0) return this.rejectIntent('SPIN', 'Place a bet first');
    const invalid = slipOps.validateBets(this.slip.bets, this.wallet);
    if (invalid) return this.rejectIntent('SPIN', invalid.message);

    this.roundNo++;
    this.roundId = `${this.deps.sessionId ?? 'S'}-${String(this.roundNo).padStart(4, '0')}`;
    this.error = null;
    this.notice = null;
    if (!this.go(RoundEvent.SPIN, `round ${this.roundId} · stake ${staked}`)) return;
    this.wheel?.launch();
    this.request();
  }

  retry(): void {
    if (this.state !== RoundState.ERROR || !this.error?.retryable) return this.rejectIntent('RETRY', 'Nothing to retry');
    this.error = null;
    if (!this.go(RoundEvent.RETRY, `round ${this.roundId}`)) return;
    this.wheel?.launch();
    this.request();
  }

  dismissError(): void {
    if (this.state !== RoundState.ERROR || !this.error?.dismissible) return this.rejectIntent('DISMISS', 'This round must be confirmed first');
    this.error = null;
    this.roundId = null;
    this.go(RoundEvent.DISMISS, 'bets kept on the felt');
    // Reconcile with the server: the wallet is server truth.
    void this.deps.provider.getBalance().then((b) => {
      if (this.disposed) return;
      this.wallet = b;
      this.emit();
    });
  }

  /** Close a settled round early; the hold timer calls this too. */
  nextRound(): void {
    if (this.state !== RoundState.RESULT) return this.rejectIntent('NEXT_ROUND', 'No settled round to close');
    if (this.holdTimer !== null) this.deps.clock.clearTimeout(this.holdTimer);
    this.holdTimer = null;
    this.slip = slipOps.closeRound(this.slip);
    this.go(RoundEvent.NEXT_ROUND);
  }

  // ------------------------------------------------------------------ provider flow

  private request(): void {
    const id = this.roundId;
    if (!id) return;
    const bets = this.slip.bets;
    this.addLog({ kind: LogKind.PROVIDER, event: 'spin →', detail: `${this.deps.provider.name} ${id}` });
    this.emit();
    this.deps.provider.spin({ roundId: id, bets }).then(
      (res) => this.onResponse(id, res),
      (e: unknown) => this.onResponse(id, { ok: false, error: providerError('NETWORK', String(e)) }),
    );
  }

  private onResponse(id: string, res: SpinResponse): void {
    if (this.disposed) return;
    if (id !== this.roundId || this.state !== RoundState.REQUESTING) {
      this.addLog({ kind: LogKind.STALE, event: 'stale response', detail: `ignored ${id}` });
      this.emit();
      return;
    }
    if (!res.ok) {
      this.error = res.error;
      this.addLog({ kind: LogKind.PROVIDER, event: '← error', detail: res.error.code });
      this.go(RoundEvent.FAILURE, res.error.code);
      this.wheel?.abort();
      this.fire({ type: 'error', error: res.error });
      return;
    }
    const o = res.outcome;
    this.pending = o;
    this.lastOutcome = o;
    this.addLog({ kind: LogKind.PROVIDER, event: '← outcome', detail: `${o.number}${o.replayed ? ' (replayed)' : ''} · net ${o.settlement.net}` });
    if (!this.go(RoundEvent.OUTCOME, `number ${o.number}`)) return;
    const landing = this.wheel ? this.wheel.land(o.number) : Promise.resolve();
    void landing.then(() => this.onLanded(id));
  }

  private onLanded(id: string): void {
    const o = this.pending;
    if (this.disposed || !o || id !== this.roundId || this.state !== RoundState.SPINNING) return;
    this.pending = null;
    this.wallet = o.balanceAfter;
    this.history = [o.number, ...this.history].slice(0, HISTORY_LENGTH);
    const result: RoundResult = { roundId: o.roundId, number: o.number, color: colorOf(o.number), settlement: o.settlement, balanceAfter: o.balanceAfter };
    this.lastResult = result;
    this.wheel?.showResult(o.number);
    this.go(RoundEvent.LANDED, `${o.number} ${result.color} · net ${o.settlement.net}`);
    this.fire({ type: 'result', result });
    this.holdTimer = this.deps.clock.setTimeout(() => {
      this.holdTimer = null;
      if (this.state === RoundState.RESULT && this.roundId === id) this.nextRound();
    }, this.deps.resultHoldMs);
  }

  // ------------------------------------------------------------------ helpers

  /** Betting is allowed on an open felt. On RESULT the settled round is closed first. */
  private openFelt(intent: string): boolean {
    if (this.state === RoundState.RESULT) this.nextRound();
    if (!isFeltOpen(this.state)) {
      this.rejectIntent(intent, 'Bets are closed');
      return false;
    }
    return true;
  }

  private applySlip(intent: string, r: slipOps.SlipResult): boolean {
    if (!r.ok) {
      this.rejectIntent(intent, r.message);
      return false;
    }
    this.slip = r.slip;
    return true;
  }

  private go(event: RoundEvent, detail?: string): boolean {
    const s = step(this.state, event);
    if (!s.ok) {
      this.addLog({ kind: LogKind.REJECTED, event, from: this.state, detail: 'illegal transition' });
      this.emit();
      return false;
    }
    this.state = s.to;
    this.addLog({ kind: LogKind.TRANSITION, event, from: s.from, to: s.to, ...(detail ? { detail } : {}) });
    this.fire({ type: 'state', from: s.from, to: s.to });
    this.emit();
    return true;
  }

  private rejectIntent(intent: string, text: string): void {
    this.addLog({ kind: LogKind.REJECTED, event: intent, from: this.state, detail: text });
    this.say(text, 'warn');
    this.fire({ type: 'rejected', text });
    this.emit();
  }

  private say(text: string, tone: Notice['tone']): void {
    this.notice = { id: ++this.seq, text, tone };
  }

  private addLog(e: Omit<LogEntry, 'id' | 't'>): void {
    this.log = [...this.log, { id: ++this.seq, t: this.deps.clock.now(), ...e }].slice(-LOG_LIMIT);
  }

  private fire(e: ControllerEvent): void {
    for (const l of this.eventListeners) l(e);
  }

  private emit(): void {
    this.snapshot = this.build();
    for (const l of this.listeners) l();
  }

  private build(): Snapshot {
    const bets = this.slip.bets;
    const staked = totalStake(bets);
    const held = this.state === RoundState.REQUESTING || this.state === RoundState.SPINNING || this.state === RoundState.ERROR;
    const betting = this.state === RoundState.BETTING;
    const result = this.state === RoundState.RESULT;
    const hasBets = staked > 0;
    const lastRound = result && hasBets ? bets : this.slip.lastRound;
    const repeatable = !!lastRound && Object.keys(lastRound).length > 0 && slipOps.validateBets(lastRound, this.wallet) === null;
    return {
      state: this.state,
      bets,
      staked,
      balance: held ? this.wallet - staked : this.wallet,
      available: betting ? this.wallet - staked : this.wallet,
      roundId: this.roundId,
      roundNo: this.roundNo,
      lastResult: this.lastResult,
      lastOutcome: this.lastOutcome,
      history: this.history,
      error: this.error,
      notice: this.notice,
      log: this.log,
      canUndo: betting && this.slip.undo.length > 0,
      canClear: betting && hasBets,
      canRebet: ((betting && !hasBets) || result) && repeatable,
      canDouble: betting && hasBets && slipOps.double(this.slip, this.wallet).ok,
      canSpin: (betting && hasBets) || (result && repeatable),
    };
  }
}
