# AGENTS.md: Operating Guide for AI Coding Agents

This file is the contract for any AI agent (or human) changing this repository.
Read it fully before your first edit in a session.

---

## 1. Before you edit anything

1. **Read the decisions.** Skim every file in [`docs/decisions/`](docs/decisions/). The ADRs are short.
   An `Accepted` ADR is binding. Do not work against it silently: to change direction, write a
   new ADR that supersedes it (see §5).
2. **Read the recent log.** `tail -n 20 docs/ai/decision-log.jsonl` shows the newest decisions last.
3. **Read the latest session report.** `ls docs/ai/reports/ | sort | tail -n 2`. Its
   *Known limitations* and *Next steps* sections are your backlog.
4. **Run the baseline.** `pnpm verify` must pass before you start. If it fails, say so in your
   report and fix or flag it before new work.

## 2. Folder boundaries

| Path | Owns | May import | Must NOT import |
|---|---|---|---|
| `src/config` | Wheel order and colours, bet kinds and payouts, limits, chips, timings, theme palette, sound recipes | nothing | everything else |
| `src/engine` | Bet spots, payout maths, bet slip (undo/rebet/double), round state machine, angle → pocket resolver, seeded RNG, provider contract, mock provider, controller | `src/config` | React, `src/renderer`, `src/audio`, `src/ui`, DOM globals (`window`, `document`, `setTimeout`, `performance`, …) |
| `src/renderer` | Wheel and ball kinematics, cached Canvas 2D art, rAF loop, frame stats; implements `WheelPort` | `src/config`, `src/engine` | React, `src/ui`, `src/audio` |
| `src/audio` | Web Audio synthesiser with mute | `src/config` | React, `src/renderer`, `src/ui` |
| `src/ui` | Composition root (`game.ts`), React components, table geometry, styles | everything above | — |

Data flows one way: **config → engine (controller) → ports (wheel, provider) → UI subscribes to snapshots.**
The UI never moves the wheel or changes balances itself. It sends intents (`place`, `undo`, `spin`, …)
to `RouletteController` and renders `getSnapshot()`.

ESLint enforces these boundaries (`eslint.config.js`). Do not disable the rules. Change the
architecture through an ADR instead.

## 3. Coding conventions

- **TypeScript strict** with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax`.
- **No `enum` and no `interface`.** Use:
  ```ts
  export const RoundState = { BETTING: 'BETTING', SPINNING: 'SPINNING' } as const;
  export type RoundState = (typeof RoundState)[keyof typeof RoundState];
  export type Settlement = { number: number; net: number };
  ```
- Cross-module results are discriminated unions (`{ ok: true, … } | { ok: false, … }`), not thrown errors.
- The engine is **pure and deterministic**: time (`Clock`), randomness (`random`, `numberFor(seed, roundId)`)
  and delays are injected. Never call `Math.random()`, `Date.now()` or timers inside `src/engine`.
- **Money is integer minor units (cents).** Format it only in `src/ui/format.ts`.
- Every payout follows `36 / coverage − 1` (ADR-0003). A test pins this, so a new bet kind must satisfy it.
- **CSS:** use even integer-pixel `line-height` values (16/20/24/28/32/40) from `src/ui/styles/tokens.css`.
  All figures (balances, chips, bets, payouts, history) use `font-variant-numeric: tabular-nums`.
  Primary actions in modals and drawers are **right-aligned**, with the primary action last. Champagne
  (`--c-accent`) is reserved for focus and win states. No neon, glow or gradient decoration.
  The e2e suite checks line heights and tabular figures automatically.
- New engine, renderer-math or geometry behaviour gets a Vitest test next to it (`*.test.ts`).
- Commits: imperative subject, ≤ 72 characters, scoped prefix (`engine:`, `renderer:`, `ui:`, `docs:`, `test:`, `chore:`).

## 4. Recording decisions (every meaningful choice)

A *meaningful* choice is one that a future engineer could reasonably have made differently:
a library, a data shape, a state transition, a public API, a performance trade-off or a UX convention.

Append one JSONL line to `docs/ai/decision-log.jsonl` with the helper, which sets the schema and the
UTC timestamp:

```bash
pnpm log:decision -- \
  --actor agent \
  --area engine/slip \
  --decision "Double is all-or-nothing" \
  --rationale "A partial double changes the layout's proportions without telling the player" \
  --files src/engine/slip.ts,src/engine/slip.test.ts \
  --tradeoffs "Near a limit, the player has to double spot by spot"
```

Schema (all fields required; `timestamp` is ISO-8601 UTC and set by the script):

```json
{"timestamp":"2026-11-24T14:00:00Z","actor":"agent","area":"…","decision":"…","rationale":"…","filesTouched":["…"],"tradeoffs":"…"}
```

The log is **append-only**. Never rewrite or delete earlier lines. If you reverse a decision, append a new entry that says so.

## 5. When to write an ADR instead

Write an ADR (`docs/decisions/ADR-XXXX-kebab-title.md`, copied from `ADR-TEMPLATE.md`, next free
number) when the decision:
- changes a folder boundary or a cross-module contract (`WheelPort`, `OutcomeProvider`, `Snapshot`, the bet catalogue);
- adds or removes a runtime dependency (today the only ones are `react` and `react-dom`); or
- reverses or supersedes an existing ADR. Set the old ADR's status to `Superseded by ADR-XXXX`.
  That is the only edit allowed to an accepted ADR.

Also add a log entry that points to the new ADR.

## 6. End-of-session report (mandatory)

```bash
pnpm report:new -- <short-slug>   # creates docs/ai/reports/YYYY-MM-DD-<short-slug>.md
```

Fill in every section: summary, completed work, key decisions (timestamps and links to ADRs and
log entries), **verification with the actual command output**, known limitations and next steps.
Do not claim a check passed unless you ran it in this session.

## 7. Verification commands

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm lint        # ESLint, including the layer and no-enum/no-interface rules
pnpm test        # Vitest: engine, physics, table geometry
pnpm build       # Vite production build
pnpm verify      # all of the above, in order
pnpm dev         # http://localhost:5177 (press ` for the inspector)
pnpm e2e         # with `pnpm dev` running: Puppeteer smoke, rules and 5 responsive layouts
                 # env: BASE_URL, CHROME_PATH, E2E_GPU=0 (software GL; skips the FPS check)
```

Any change to UI, layout, renderer or round flow must pass `pnpm e2e` before you report it done.
Headless software rendering (SwiftShader) is slow, so quote FPS only from a GPU run.

Useful query parameters for QA: `?seed=abc`, `?force=17`, `?latency=80-160`, `?landing=1500`,
`?hold=1500`, `?inspector=1`.
