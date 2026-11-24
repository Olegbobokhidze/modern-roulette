import { describe, expect, it } from 'vitest';
import { RouletteController, type Clock, type WheelPort } from './controller';
import { MockProvider, type MockSettings } from './mock-provider';

/** Manual clock: timers run only when the test says so. */
function fakeClock() {
  let now = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let id = 0;
  const clock: Clock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      timers.set(++id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [k, t] of [...timers]) if (t.at <= now) {
      timers.delete(k);
      t.fn();
    }
  };
  return { clock, advance };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function setup(settings: Partial<MockSettings> = {}, wheel?: WheelPort) {
  const { clock, advance } = fakeClock();
  const provider = new MockProvider({
    delay: () => Promise.resolve(),
    now: clock.now,
    random: () => 0.5,
    startingBalance: 10_000,
    settings: { seed: 'test', latencyMin: 0, latencyMax: 0, errorRate: 0, ...settings },
  });
  const c = new RouletteController({ provider, clock, startingBalance: 10_000, resultHoldMs: 3000 });
  if (wheel) c.attachWheel(wheel);
  return { c, provider, advance };
}

describe('RouletteController', () => {
  it('plays a full round and settles from the server outcome', async () => {
    const { c, advance } = setup({ forceNumber: 17 });
    c.place('straight:17', 100);
    c.place('red', 500);
    expect(c.getSnapshot().available).toBe(9_400);
    c.spin();
    expect(c.getSnapshot().state).toBe('REQUESTING');
    expect(c.getSnapshot().balance).toBe(9_400); // stake held
    await flush();
    const s = c.getSnapshot();
    expect(s.state).toBe('RESULT');
    expect(s.lastResult?.number).toBe(17);
    expect(s.balance).toBe(10_000 - 600 + 3_600);
    expect(s.history).toEqual([17]);
    expect(s.bets).toEqual({ 'straight:17': 100, red: 500 }); // chips stay on the felt during the result
    advance(3000);
    expect(c.getSnapshot().state).toBe('BETTING');
    expect(c.getSnapshot().bets).toEqual({});
    expect(c.getSnapshot().canRebet).toBe(true);
  });

  it('does not reveal the balance until the wheel lands', async () => {
    let land: () => void = () => {};
    const wheel: WheelPort = { launch() {}, abort() {}, showResult() {}, land: () => new Promise<void>((r) => (land = r)) };
    const { c } = setup({ forceNumber: 3 }, wheel);
    c.place('straight:3', 100);
    c.spin();
    await flush();
    expect(c.getSnapshot().state).toBe('SPINNING');
    expect(c.getSnapshot().balance).toBe(9_900);
    land();
    await flush();
    expect(c.getSnapshot().state).toBe('RESULT');
    expect(c.getSnapshot().balance).toBe(9_900 + 3_600);
  });

  it('rejects double spins and bets while the wheel turns', async () => {
    const wheel: WheelPort = { launch() {}, abort() {}, showResult() {}, land: () => new Promise<void>(() => {}) };
    const { c, provider } = setup({}, wheel);
    c.place('odd', 100);
    c.spin();
    c.spin();
    c.place('even', 100);
    await flush();
    c.spin();
    expect(provider.getStats().spins).toBe(1);
    expect(c.getSnapshot().bets).toEqual({ odd: 100 });
    expect(c.getSnapshot().log.filter((l) => l.kind === 'rejected').length).toBeGreaterThanOrEqual(3);
  });

  it('refuses to spin an empty felt', () => {
    const { c } = setup();
    c.spin();
    expect(c.getSnapshot().state).toBe('BETTING');
    expect(c.getSnapshot().notice?.text).toBe('Place a bet first');
  });

  it('network failure: nothing charged, bets kept, dismiss returns to betting', async () => {
    const { c } = setup({ nextFailure: 'network' });
    c.place('black', 500);
    c.spin();
    await flush();
    expect(c.getSnapshot().state).toBe('ERROR');
    expect(c.getSnapshot().error?.dismissible).toBe(true);
    c.dismissError();
    await flush();
    const s = c.getSnapshot();
    expect(s.state).toBe('BETTING');
    expect(s.bets).toEqual({ black: 500 });
    expect(s.balance).toBe(10_000);
  });

  it('timeout after commit: must retry, and the retry replays the same round (no double charge)', async () => {
    const { c, provider } = setup({ nextFailure: 'timeout', forceNumber: 0 });
    c.place('straight:0', 100);
    c.spin();
    await flush();
    expect(c.getSnapshot().error?.code).toBe('TIMEOUT');
    c.dismissError(); // not allowed
    expect(c.getSnapshot().state).toBe('ERROR');
    c.retry();
    await flush();
    const s = c.getSnapshot();
    expect(s.state).toBe('RESULT');
    expect(s.lastOutcome?.replayed).toBe(true);
    expect(s.balance).toBe(10_000 + 3_500);
    expect(provider.getStats().committed).toBe(1);
  });

  it('spin from RESULT repeats the same bets', async () => {
    const { c, provider } = setup({ forceNumber: 1 });
    c.place('low', 1_000);
    c.spin();
    await flush();
    expect(c.getSnapshot().state).toBe('RESULT');
    c.spin();
    await flush();
    expect(provider.getStats().spins).toBe(2);
    expect(c.getSnapshot().lastResult?.settlement.totalStake).toBe(1_000);
  });

  it('betting during RESULT opens a fresh round first', async () => {
    const { c } = setup({ forceNumber: 2 });
    c.place('red', 500);
    c.spin();
    await flush();
    c.place('black', 100);
    const s = c.getSnapshot();
    expect(s.state).toBe('BETTING');
    expect(s.bets).toEqual({ black: 100 });
  });

  it('ignores a late response for an abandoned round', async () => {
    let resolveSpin: (v: Awaited<ReturnType<MockProvider['spin']>>) => void = () => {};
    const { c, provider } = setup();
    const real = provider.spin.bind(provider);
    provider.spin = () => new Promise((r) => (resolveSpin = r)).then((v) => v as Awaited<ReturnType<typeof real>>);
    c.place('red', 100);
    c.spin();
    // Simulate the round being failed and dismissed before the late reply arrives.
    (c as unknown as { onResponse: (id: string, r: unknown) => void }).onResponse(c.getSnapshot().roundId!, { ok: false, error: { code: 'NETWORK', message: 'x', retryable: true, dismissible: true } });
    c.dismissError();
    resolveSpin(await real({ roundId: 'S-0001', bets: { red: 100 } }));
    await flush();
    expect(c.getSnapshot().state).toBe('BETTING');
    expect(c.getSnapshot().log.some((l) => l.kind === 'stale')).toBe(true);
  });
});
