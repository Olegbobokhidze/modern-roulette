# Session Report: initial-build

- **Date:** 2026-11-24
- **Started:** 2026-11-24T13:45:00Z
- **Ended:** 2026-11-24T14:23:00Z
- **Actor(s):** human (Oleg Bobokhidze, brief) · agent (Claude, implementation)
- **Branch / commits:** `main`, initial commits of this repository

## 1. Summary

This session built a self-contained, minimalist European roulette frontend in `programming/modern-roulette`.
It has a pure, deterministic round engine and a two-phase wheel and ball renderer that always settles on
the server's number. The betting table shows coverage and odds on hover or focus, and a provider inspector
steers latency, failures and outcomes. Full traceability is in place: AGENTS.md, four ADRs, a decision log
and this report.

## 2. Completed Work

- [x] Tooling: Vite 6, React 18, strict TypeScript, ESLint flat config with layer rules and no `enum`/`interface`, Vitest, Puppeteer e2e ([package.json](../../../package.json), [eslint.config.js](../../../eslint.config.js)).
- [x] **Config** ([src/config](../../../src/config)): European wheel order and colours, 15 bet kinds with payouts and limits, chips, timings, wheel palette, sound recipes.
- [x] **Engine** ([src/engine](../../../src/engine)):
  - 157 bet spots, including trios and first four.
  - Integer settlement.
  - Slip with undo, clear, rebet and double, plus capping.
  - Whitelist round machine.
  - Angle ↔ pocket resolver.
  - Seeded RNG with `numberFor(seed, roundId)`.
  - `OutcomeProvider` contract.
  - `MockProvider` with latency, random and one-shot failures, forced number, and idempotent replay.
  - `RouletteController` with a snapshot store, a timestamped event log and a stale-response guard.
- [x] **Renderer** ([src/renderer](../../../src/renderer)):
  - Pure dual-motion kinematics ([physics.ts](../../../src/renderer/physics.ts)) with a free run, a Hermite landing plan, deflector scatter and a damped settle.
  - Cached high-DPI Canvas 2D bowl and rotor.
  - rAF loop with clamped dt.
  - Result highlight, ball trail and contact shadow.
  - Frame stats.
  - Sound events.
- [x] **Audio** ([src/audio/sound.ts](../../../src/audio/sound.ts)): synthesised chip, launch, rim roll, fret ticks, seat and win sounds, with persisted mute and a safe no-op fallback.
- [x] **UI** ([src/ui](../../../src/ui)):
  - Header with a count-up balance.
  - Wheel panel with the result readout.
  - History strip with the red/black/zero split.
  - Betting table with hotspots, a coverage preview and win/loss stack states.
  - Chip rack and action dock (Undo, Clear, Rebet, 2×, Spin).
  - Rules sheet, error dialog, toast, and the inspector drawer.
  - Responsive layouts for desktop, tablet, phone portrait (vertical table) and phone landscape.
- [x] Docs: [AGENTS.md](../../../AGENTS.md), [README.md](../../../README.md), ADR-0001…0004, 17 decision-log entries, this report.

## 3. Key Decisions

| Timestamp (UTC) | Area | Decision | Reference |
|---|---|---|---|
| 2026-11-24T14:18:54Z | architecture | config → engine → renderer/audio → ui layers, lint-enforced | [ADR-0001](../../decisions/ADR-0001-project-structure-and-boundaries.md), log line 2 |
| 2026-11-24T14:18:54Z | engine + renderer | Whitelist round machine; free run then a Hermite landing plan to the server pocket | [ADR-0002](../../decisions/ADR-0002-decoupled-engine-and-dual-motion-physics.md), log lines 3–5 |
| 2026-11-24T14:18:54Z | bets / table | Bet catalogue as data, `36/coverage − 1` invariant, quarter-turn portrait geometry | [ADR-0003](../../decisions/ADR-0003-betting-grid-and-payout-model.md), log lines 6–7, 11 |
| 2026-11-24T14:18:54Z | provider | Unions not throws; roundId idempotency; TIMEOUT is retry-only | [ADR-0004](../../decisions/ADR-0004-provider-adapter-and-error-recovery.md), log lines 8–9 |
| 2026-11-24T14:20:53Z | ui/preview | Fixed-height preview line (e2e caught a layout shift that swallowed clicks) | decision-log line 12 |
| 2026-11-24T14:20:53Z | ui/sheets | Esc closes only the topmost sheet (open-stack) | decision-log line 15 |

## 4. Verification

All commands were run in this session on 2026-11-24.

| Check | Command | Result |
|---|---|---|
| Types | `pnpm typecheck` | pass (0 errors) |
| Lint | `pnpm lint` | pass (0 problems) |
| Tests | `pnpm test` | **43/43 passed** in 8 files (engine 31, physics 7, geometry 5) |
| Build | `pnpm build` | pass: JS 207.55 kB (67.60 kB gzip), CSS 27.75 kB (6.41 kB gzip) |
| E2E | `pnpm dev` + `pnpm e2e` (GPU Chrome) | **44/44 checks passed**, 60 fps mid-spin |

The e2e suite covers:

- boot with no console errors, and a painted high-DPI canvas;
- corner, zero-split, dozen and keyboard-focus previews;
- stacking, undo, undoable clear and 2×;
- a full forced-17 round: stake held, balance hidden until landing, resolver "pocket under ball = 17", exact settlement to €1,340.00, winner and loser marks, history;
- result hold, then rebet;
- network failure, a right-aligned dialog, and dismiss with nothing charged;
- timeout after commit: retry-only, `replayed: true`, a single charge;
- spin again from the result;
- chip keys, a spot-limit cap with a notice, and Ctrl+Z;
- the rules modal: primary action focused and right-aligned, and Esc closes only the modal;
- every explicit line height is an even integer;
- tabular-nums on all figures;
- five layouts (360×740, 390×844, 844×390, 820×1180, 1280×720) with no overflow, all controls in view, and the correct table orientation.

Unit highlights:

- 400 randomised landing plans all settle on the requested number.
- The settle rattle never leaves the pocket.
- The chi-square uniformity test over 37 000 rounds passes.
- Every payout satisfies `36/coverage − 1`.
- Hotspots touch exactly the numbers they cover.

## 5. Known Limitations

- Inside hotspots (splits, corners, streets, lines) are not keyboard tab stops. Keyboard users can bet straights and outside bets only. A roving-focus grid with arrow keys would fix this.
- `HttpProvider` is not implemented. Only the mock exists behind `OutcomeProvider`.
- rAF pauses in hidden tabs, so the result is revealed when the tab becomes visible again (intended, but worth knowing).
- The dark theme only. Web fonts come from Google Fonts, with system fallbacks if they are unavailable offline.
- Mute only, with no volume slider. Sound is untested in e2e (headless audio is not asserted).
- On the narrowest phones (≤ 360 px) the preview line is clipped to two lines.
- No deploy configuration yet (it was not requested).

## 6. Next Steps

1. Keyboard roving focus across the full bet grid (arrow keys move across edges and corners) with screen-reader announcements of coverage.
2. `HttpProvider` with response validation and `NETWORK`/`TIMEOUT` mapping, plus contract tests shared with `MockProvider`.
3. Racetrack (neighbours, voisins, tiers, orphelins) as an alternative bet surface built from `WHEEL_ORDER`.
4. A session statistics panel (hot and cold numbers) and a configurable La Partage variant.
5. Deploy configuration (Netlify or Vercel) if a public demo link is wanted.
