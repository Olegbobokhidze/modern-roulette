/**
 * Composition root (ADR-0001): the only place that wires config, engine, provider, audio and (later,
 * from WheelPanel) the renderer. Query params give QA and e2e reproducible sessions:
 *   ?seed=…  ?latency=80-160  ?force=17  ?landing=1500  ?hold=1500  ?inspector=1
 */
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MOCK_DEFAULTS, STARTING_BALANCE, TIMING } from '../config/game';
import { isRouletteNumber } from '../config/wheel';
import { RouletteController, type Clock, type Snapshot } from '../engine/controller';
import { MockProvider, type MockSettings } from '../engine/mock-provider';
import { createRng, hashString } from '../engine/rng';
import { SoundManager } from '../audio/sound';

export type Game = {
  readonly controller: RouletteController;
  readonly provider: MockProvider;
  readonly sound: SoundManager;
  readonly landingMs: number;
  readonly reducedMotion: boolean;
  readonly initialInspector: boolean;
};

const browserClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (h) => window.clearTimeout(h as number),
};

function intParam(p: URLSearchParams, key: string): number | null {
  const v = p.get(key);
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function createGame(search: string): Game {
  const p = new URLSearchParams(search);
  const seed = p.get('seed') ?? MOCK_DEFAULTS.seed;
  const [lo, hi] = (p.get('latency') ?? '').split('-').map(Number);
  const force = intParam(p, 'force');
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const provider = new MockProvider({
    delay: (ms) => new Promise((r) => window.setTimeout(r, ms)),
    now: browserClock.now,
    random: createRng(hashString(`${seed}:latency`) % 4294967296),
    startingBalance: STARTING_BALANCE,
    settings: {
      seed,
      latencyMin: Number.isFinite(lo) ? (lo as number) : MOCK_DEFAULTS.latencyMin,
      latencyMax: Number.isFinite(hi) ? (hi as number) : Number.isFinite(lo) ? (lo as number) : MOCK_DEFAULTS.latencyMax,
      errorRate: MOCK_DEFAULTS.errorRate,
      forceNumber: force !== null && isRouletteNumber(force) ? force : null,
    },
  });

  const controller = new RouletteController({
    provider,
    clock: browserClock,
    startingBalance: STARTING_BALANCE,
    resultHoldMs: intParam(p, 'hold') ?? TIMING.resultHoldMs,
    sessionId: hashString(`${seed}:${Date.now()}`).toString(36).slice(0, 5).toUpperCase(),
  });

  const sound = new SoundManager();
  controller.on((e) => {
    if (e.type === 'placed') sound.chip();
    else if (e.type === 'removed') sound.chip(true);
    else if (e.type === 'error') sound.error();
    else if (e.type === 'result' && e.result.settlement.net > 0) {
      sound.win(e.result.settlement.totalReturned >= e.result.settlement.totalStake * 10);
    }
  });

  return {
    controller,
    provider,
    sound,
    landingMs: intParam(p, 'landing') ?? TIMING.landingMs,
    reducedMotion,
    initialInspector: p.get('inspector') === '1',
  };
}

export const GameContext = createContext<Game | null>(null);

export function useGame(): Game {
  const g = useContext(GameContext);
  if (!g) throw new Error('useGame must be used inside <GameContext.Provider>');
  return g;
}

export function useSnapshot(): Snapshot {
  const { controller } = useGame();
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}

export function useMockSettings(): MockSettings {
  const { provider } = useGame();
  return useSyncExternalStore(provider.subscribe, provider.getSettings);
}

export function useMuted(): boolean {
  const { sound } = useGame();
  return useSyncExternalStore(sound.subscribe, sound.isMuted);
}

export function useMedia(query: string): boolean {
  const get = () => globalThis.matchMedia?.(query).matches ?? false;
  return useSyncExternalStore(
    (l) => {
      const m = globalThis.matchMedia?.(query);
      m?.addEventListener('change', l);
      return () => m?.removeEventListener('change', l);
    },
    get,
    () => false,
  );
}

/** Ease a displayed figure toward `target` from wherever it currently is (single text node, rAF). */
export function useCountUp(target: number, ms = 650): number {
  const [value, setValue] = useState(target);
  const shown = useRef(target);
  useEffect(() => {
    const from = shown.current;
    if (from === target || (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)) {
      shown.current = target;
      setValue(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / ms);
      const v = Math.round(from + (target - from) * (1 - (1 - u) ** 3));
      shown.current = v;
      setValue(v);
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
