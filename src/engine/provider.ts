/**
 * Outcome provider contract (ADR-0004). The server decides the number and settles. The client only
 * animates toward it and displays the settlement. Responses are discriminated unions, so no adapter
 * throws across this boundary.
 */
import type { Bets, Settlement } from './payout';

export type SpinRequest = {
  /** Idempotency key: re-sending the same id after a timeout replays the committed result. */
  readonly roundId: string;
  readonly bets: Bets;
};

export type SpinOutcome = {
  readonly roundId: string;
  readonly number: number;
  readonly settlement: Settlement;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  /** Public fingerprint of the server seed, for the inspector's "reproduce this round" view. */
  readonly seedFingerprint: string;
  readonly committedAt: number;
  /** True when this response replays an already-committed round (idempotent retry). */
  readonly replayed: boolean;
};

export const ProviderErrorCode = {
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_BET: 'INVALID_BET',
} as const;
export type ProviderErrorCode = (typeof ProviderErrorCode)[keyof typeof ProviderErrorCode];

export type ProviderError = {
  readonly code: ProviderErrorCode;
  readonly message: string;
  /** Retrying with the same roundId is safe. */
  readonly retryable: boolean;
  /**
   * The round can be abandoned without reconciliation. This is false for TIMEOUT: the server may already
   * have committed the round, so the client must retry (replay) before it can show a balance.
   */
  readonly dismissible: boolean;
};

export type SpinResponse = { readonly ok: true; readonly outcome: SpinOutcome } | { readonly ok: false; readonly error: ProviderError };

export type OutcomeProvider = {
  readonly name: string;
  getBalance(): Promise<number>;
  spin(request: SpinRequest): Promise<SpinResponse>;
};

export const PROVIDER_ERRORS: { readonly [C in ProviderErrorCode]: Omit<ProviderError, 'code'> } = {
  NETWORK: { message: 'The connection dropped before the table confirmed your bets. Nothing was charged.', retryable: true, dismissible: true },
  TIMEOUT: { message: 'The table did not answer in time. Your round may already be settled, so it is being confirmed.', retryable: true, dismissible: false },
  INSUFFICIENT_FUNDS: { message: 'The table declined the bets: not enough balance.', retryable: false, dismissible: true },
  INVALID_BET: { message: 'The table declined the bets as invalid.', retryable: false, dismissible: true },
};

export const providerError = (code: ProviderErrorCode, message?: string): ProviderError => ({
  code,
  ...PROVIDER_ERRORS[code],
  ...(message ? { message } : {}),
});
