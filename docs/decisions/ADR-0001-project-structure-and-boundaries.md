# ADR-0001: Project structure and layer boundaries

- **Date:** 2026-11-24T14:18:54Z
- **Status:** Accepted
- **Deciders:** agent (Claude), on behalf of Oleg Bobokhidze
- **Related:** ADR-0002, ADR-0003, ADR-0004; decision-log entries for `architecture`

## Context

The project is a portfolio roulette frontend that should read like provider-grade code. The round
logic has to be testable without a browser, the wheel has to animate at a smooth frame rate without
React re-rendering each frame, and a real backend has to be able to replace the mock without
touching the UI. The brief also asks for a self-contained folder that can be installed and demoed
on its own.

## Decision

A single Vite + React 18 + TypeScript package with five layers under `src/`, imported strictly
downward and enforced by ESLint (`no-restricted-imports` and `no-restricted-globals`):

```
config  →  engine  →  renderer / audio  →  ui
```

- `config`: data only (wheel order, bet catalogue, limits, chips, timings, palette, sound recipes).
- `engine`: pure TypeScript, with no DOM, timers or `Math.random`. Holds the controller, round
  machine, bet slip, payout, resolver, RNG and the provider contract with its mock.
- `renderer`: Canvas 2D, implementing the engine's `WheelPort`.
- `audio`: Web Audio synthesis, bound to controller and renderer events in the composition root.
- `ui`: React components and `game.ts`, the only module that wires everything together.

`audio` is a fifth folder next to the four in the brief. Sound is a runtime side effect, not
configuration, so its recipes live in `config/sound.ts` and the player lives in `audio/`.

Conventions: strict TypeScript, no `enum` or `interface` (lint-enforced), integer minor units for
money, and discriminated unions across module boundaries.

## Alternatives Considered

1. **pnpm monorepo with packages per layer** (as in the sibling slot project). This gives stronger
   isolation, but adds workspace tooling the brief doesn't need. Lint rules give the same guarantees
   in a single package.
2. **State in React (useReducer or Zustand).** Simpler to start, but the round logic would then need
   React to test it, and the renderer would depend on React's scheduling.
3. **PixiJS or WebGL for the wheel.** That would be overkill for two rotating images and a ball, and it
   adds a runtime dependency. Canvas 2D with cached layers holds 60 fps (ADR-0002).

## Trade-offs

| We gain | We give up |
|---|---|
| Engine tests run in milliseconds in Node | Some wiring code in `game.ts` and `WheelPanel` |
| The renderer is swappable behind `WheelPort` | Lint rules, not package boundaries, enforce layering |
| Runtime dependencies are only react and react-dom | No physics or animation libraries to lean on |

## Consequences

New behaviour goes into the lowest layer that can own it. UI components stay thin, sending
intents and rendering snapshots. Any new cross-layer contract needs an ADR (AGENTS.md §5).
