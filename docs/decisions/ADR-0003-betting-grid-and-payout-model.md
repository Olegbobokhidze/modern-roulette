# ADR-0003: Betting grid, bet catalogue and payout model

- **Date:** 2026-11-24T14:18:54Z
- **Status:** Accepted
- **Deciders:** agent (Claude), on behalf of Oleg Bobokhidze
- **Related:** ADR-0001; `src/config/bets.ts`, `src/engine/spots.ts`, `src/engine/payout.ts`, `src/engine/slip.ts`, `src/ui/table-geometry.ts`

## Context

The table must support every standard single-zero bet: straight, split, street, trio, corner, first
four, six line, dozen, column and the even-money bets. The hover/focus preview, the settlement, the
mock server and the rules sheet all need the same truth about what a bet covers and pays. The
layout also has to work horizontally on desktop and vertically on phones.

## Decision

- **Catalogue as data.** `SPOTS` (157 entries) is generated once: `{ id, kind, numbers, label }`
  with stable ids (`straight:17`, `split:17-20`, `corner:17`, `line:13`, `dozen:2`, `red`, …).
  `BET_KINDS` holds coverage, payout and per-spot max for each kind.
- **One payout rule.** `payout = 36 / coverage − 1` for every kind, so every bet has the same
  97.30% RTP. A test pins this invariant and the 1/37 edge. Zero loses all outside bets (no la
  partage).
- **Settlement** is pure integer maths: `returned = stake × (payout + 1)` on a win, otherwise 0.
  The mock server and any future verifier use the same `settle()`.
- **Slip.** Immutable, with an undo stack of previous bet maps, where clear and remove are themselves
  undoable. Rebet replaces the felt with the last settled round, and Double doubles every stake.
  Both are all-or-nothing, so the layout keeps its proportions. A single chip that would pass a
  limit (spot, round or balance) is **capped** to what fits, with a notice, and rejected only when
  nothing fits.
- **Geometry.** One 14 × 5 unit grid for landscape. Portrait is the exact quarter-turn
  `(x, y, w, h) → (5 − y − h, x, h, w)`: zero on top, 1·2·3 reading left to right, outside bets on the
  left. Inside bets other than straights are hotspots centred on the shared edge or corner, and
  street, six-line and first-four sit on the bottom edge by convention. Hotspots grow on coarse
  pointers (0.46 vs 0.34 units). Geometry tests check containment, uniqueness and adjacency.
- **Preview.** Hover or focus sets one `preview` spot. The covered number cells highlight, and a
  fixed-height line shows name, numbers, odds, coverage (n/37, %), what the selected chip returns,
  and the spot limit. During the result it shows what that spot won or lost. The line has a fixed
  height so that a wrap can never move the felt under the pointer.

## Alternatives Considered

1. **SVG table.** Easy to draw hotspots, but each hotspot is a less accessible element, and
   responsive text sizing inside a transformed SVG is awkward.
2. **Payout table per spot id.** Flexible, but it would allow inconsistent edges. The uniform
   rule is both correct and checkable.
3. **Reject over-limit chips.** Strict, but frustrating at the limit. Capping is what live tables do.

## Trade-offs

| We gain | We give up |
|---|---|
| Preview, settlement, server and rules cannot drift | Variants (La Partage, American 00) need new kinds or a config switch |
| One geometry function serves both orientations | Portrait outside labels need vertical text |
| Undo, rebet and double are trivially correct (pure functions) | Undo history is cleared when a round closes (by design) |

## Consequences

Adding a variant means extending `BET_KINDS`/`SPOTS` and keeping the payout invariant test green.
Inside hotspots are mouse and touch targets with `tabIndex=-1`. Keyboard users get straights and
outside bets via Tab, which is a known limitation (see the session report).
