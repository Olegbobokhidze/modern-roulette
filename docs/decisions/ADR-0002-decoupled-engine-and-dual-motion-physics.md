# ADR-0002: Decoupled round engine and dual-motion wheel/ball kinematics

- **Date:** 2026-11-24T14:18:54Z
- **Status:** Accepted
- **Deciders:** agent (Claude), on behalf of Oleg Bobokhidze
- **Related:** ADR-0001, ADR-0004; `src/engine/machine.ts`, `src/engine/controller.ts`, `src/engine/resolver.ts`, `src/renderer/physics.ts`

## Context

Roulette has to look physical: the wheel turns one way and the ball the other, then the ball
slows, drops, scatters on the deflectors and rattles into a pocket. But the number is decided by
the server (ADR-0004), not by the animation. A free physics simulation can't be made to land on a
given pocket without visible cheating, and starting the animation only after the server replies
makes every spin feel laggy.

## Decision

**Round machine.** `RoundState` = `BETTING → REQUESTING → SPINNING → RESULT → BETTING`, with
`REQUESTING → ERROR → (RETRY → REQUESTING | DISMISS → BETTING)`. A whitelist table
(`TRANSITIONS`) is the only source of legal moves. Illegal events are rejected and logged with a
timestamp, never thrown. Betting is legal on `BETTING`; on `RESULT` a bet first closes the
settled round. The stake is shown as held from `REQUESTING` onward, and the confirmed balance is
revealed only when the renderer reports the ball has landed.

**Two-phase motion behind `WheelPort`** (`launch()`, `land(n): Promise`, `abort()`, `showResult()`):

1. `launch()` on SPIN, before the outcome is known. The wheel eases up to spin speed and the ball
   is launched counter-clockwise on the rim, losing speed to exponential friction. The player
   gets feedback immediately; network latency is hidden in this free run.
2. `land(n)` when the outcome arrives, planned **from the current state** so nothing jumps:
   - wheel: `ω(t) = ω_idle + (ω₀ − ω_idle)·e^(−kt)` (analytic, never reverses);
   - ball, relative to the wheel: a cubic Hermite curve `φ(t)` from `(φ₀, φ̇₀)` to
     `(pocketOffset(n) + 2πm, 0)`. The winding `m` is chosen nearest to constant-deceleration travel
     `φ̇₀·T/2`, so the curve is monotonic and reads as friction;
   - drop: past 58% of the approach, the radius eases from rim to pocket with deflector bumps and an
     angular scatter windowed to zero at the seat;
   - settle: a damped rattle of ±0.045 rad, under half a pocket (0.085 rad), so the resolved number
     can never change.

**Resolver.** `pocketAt(wheelAngle, ballAngle)` and its inverse `pocketOffset(n)` are the single
definition of angle ↔ pocket. They are used by the planner, the inspector ("pocket under ball")
and the tests.

**Renderer.** One rAF loop with clamped `dt` (≤ 50 ms). The bowl and rotor are painted once per
size into offscreen canvases at DPR ≤ 2, and a frame is roughly four draw calls. Reduced motion uses
a 1.8 s landing without scatter or rattle.

## Alternatives Considered

1. **Rigid-body simulation with outcome steering**: realistic, but steering is visible as
   unnatural nudges, and it is non-deterministic across frame rates.
2. **Pre-recorded spins per pocket**: perfectly deterministic, but repetitive, heavy, and
   unable to start before the outcome is known.
3. **Animate only after the response**: simplest, but every spin waits on network latency.

## Trade-offs

| We gain | We give up |
|---|---|
| Lands on the server number every time: 400 randomised plans in tests, plus a live e2e check | Not a true physics simulation; deflector scatter is stylised |
| Instant response to SPIN, with latency hidden in the free run | Very long latency means a long free run (the ball keeps slowing) |
| Pure functions of time, testable without a browser | Hermite parameters need tuning by eye |

## Consequences

The renderer can be replaced (WebGL, 3D) as long as it implements `WheelPort` and resolves `land()`
once the ball is seated. If the tab is hidden, rAF pauses, so `land()` resolves only when the tab
is visible again. The settlement then appears on return, which is intended.
