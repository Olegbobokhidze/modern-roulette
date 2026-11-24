# ADR-0004: Outcome provider adapter, idempotent rounds and error recovery

- **Date:** 2026-11-24T14:18:54Z
- **Status:** Accepted
- **Deciders:** agent (Claude), on behalf of Oleg Bobokhidze
- **Related:** ADR-0002, ADR-0003; `src/engine/provider.ts`, `src/engine/mock-provider.ts`, `src/engine/controller.ts`, `src/ui/components/Inspector.tsx`

## Context

In production, a game server decides the number, holds the wallet and settles. The frontend must
never decide outcomes or balances, must survive latency and dropped connections, and must never
charge a player twice for one round. The demo needs a believable in-browser server that QA can
steer.

## Decision

- **Contract.** `OutcomeProvider = { name, getBalance(), spin({ roundId, bets }) }`. `spin` resolves
  to `{ ok: true, outcome } | { ok: false, error }` and never throws across the boundary. An outcome
  carries `number`, the full `settlement`, `balanceBefore`/`balanceAfter`, a seed fingerprint and
  `replayed`.
- **Idempotency key.** The client creates `roundId` (`<session>-<n>`) once per round and reuses it on
  retry. The server returns the already-committed outcome for a known id (`replayed: true`) instead
  of settling again.
- **Error taxonomy** (`ProviderError.code` with `retryable` and `dismissible`):
  - `NETWORK`: not committed. The player can retry or return to the table, keeping bets and paying nothing.
  - `TIMEOUT`: may be committed. It is **retry-only**: the client must confirm by replaying before it
    shows any balance.
  - `INSUFFICIENT_FUNDS`, `INVALID_BET`: declined by the server. Dismiss only; the balance is reconciled with `getBalance()`.
- **Stale guard.** A response is applied only if its `roundId` matches the current round and the
  state is still `REQUESTING`. Anything else is logged as `stale` and ignored.
- **MockProvider.** An in-memory server with an injected `delay`, `now` and `random` (seeded), so tests
  are instant and deterministic. The number is `numberFor(seed, roundId)` (cyrb53 → mulberry32, with
  rejection sampling for exact uniformity; a chi-square test runs over 37 000 rounds). The server
  validates bets with the same `validateBets` as the client. The inspector can change latency, a random
  failure rate, a one-shot "next spin" failure (network, timeout after commit, declined), a forced
  number for QA, and the seed.
- **Inspector.** Shows the state chain, round id, provider stats (requests, committed rounds,
  server wallet), the last raw outcome, renderer telemetry, and a timestamped event log of
  transitions, rejections, provider calls and stale responses.

## Alternatives Considered

1. **Client-side RNG.** Simpler, but not how real-money games work, and it teaches the wrong architecture.
2. **Throwing errors / exceptions.** Error handling then becomes implicit and easy to miss. Unions
   force every caller to handle failure.
3. **Treating timeouts as network errors.** That risks a double charge or a lost win. The separate
   `TIMEOUT` code makes reconciliation explicit.

## Trade-offs

| We gain | We give up |
|---|---|
| A real backend slots in behind one type | An HTTP adapter is not implemented yet (next step) |
| Retries are safe by construction | The server must persist round ids (documented contract) |
| QA can reproduce any round from (seed, roundId) | The forced-number override must never ship in a real adapter |

## Consequences

An `HttpProvider` must map transport failures to `NETWORK`/`TIMEOUT` correctly, validate response
shapes before returning `ok: true`, and send `roundId` as the idempotency key.
