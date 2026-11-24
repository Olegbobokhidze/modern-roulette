import { useEffect, useState, useSyncExternalStore } from 'react';
import { RoundState } from '../../engine/machine';
import { FailureMode } from '../../engine/mock-provider';
import { seedFingerprint } from '../../engine/rng';
import type { WheelDebug, WheelView } from '../../renderer/wheel-view';
import { clockTime, formatMoney } from '../format';
import { useGame, useMockSettings, useSnapshot } from '../game';
import { Sheet } from './Sheet';

const CHAIN = [RoundState.BETTING, RoundState.REQUESTING, RoundState.SPINNING, RoundState.RESULT] as const;

type Props = { readonly open: boolean; readonly onClose: () => void; readonly view: WheelView | null };

export function Inspector({ open, onClose, view }: Props) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="drawer"
      kicker={`Provider · ${useGame().provider.name}`}
      title="Inspector"
      className="inspector"
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <StateSection />
      <ProviderSection />
      <RendererSection view={view} />
      <OutcomeSection />
      <LogSection />
    </Sheet>
  );
}

function StateSection() {
  const s = useSnapshot();
  return (
    <section className="insp">
      <h3 className="insp__title">Round state</h3>
      <ol className="chain" data-testid="state-chain">
        {CHAIN.map((st) => (
          <li key={st} className={`pill ${s.state === st ? 'is-active' : ''}`}>
            {st}
          </li>
        ))}
        <li className={`pill pill--error ${s.state === 'ERROR' ? 'is-active' : ''}`}>ERROR</li>
      </ol>
      <dl className="kv">
        <dt>Round</dt>
        <dd data-testid="round-id">{s.roundId ?? '—'}</dd>
        <dt>Rounds played</dt>
        <dd>{s.roundNo}</dd>
        <dt>On the felt</dt>
        <dd>
          {Object.keys(s.bets).length} spots · {formatMoney(s.staked)}
        </dd>
      </dl>
    </section>
  );
}

function ProviderSection() {
  const { provider } = useGame();
  const m = useMockSettings();
  const stats = useSyncExternalStore(provider.subscribe, () => JSON.stringify(provider.getStats()));
  const st = JSON.parse(stats) as ReturnType<typeof provider.getStats>;
  const [seed, setSeed] = useState(m.seed);

  return (
    <section className="insp">
      <h3 className="insp__title">Mock provider</h3>
      <label className="field">
        <span className="field__label">
          Latency <output className="field__value">{m.latencyMin}–{m.latencyMax} ms</output>
        </span>
        <span className="field__pair">
          <input type="range" min={0} max={3000} step={20} value={m.latencyMin} onChange={(e) => provider.update({ latencyMin: Number(e.target.value) })} aria-label="Minimum latency" />
          <input type="range" min={0} max={3000} step={20} value={m.latencyMax} onChange={(e) => provider.update({ latencyMax: Number(e.target.value) })} aria-label="Maximum latency" />
        </span>
      </label>
      <label className="field">
        <span className="field__label">
          Random network failures <output className="field__value">{Math.round(m.errorRate * 100)}%</output>
        </span>
        <input type="range" min={0} max={0.5} step={0.01} value={m.errorRate} onChange={(e) => provider.update({ errorRate: Number(e.target.value) })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field__label">Next spin</span>
          <select value={m.nextFailure} onChange={(e) => provider.update({ nextFailure: e.target.value as FailureMode })} data-testid="next-failure">
            <option value={FailureMode.NONE}>Succeeds</option>
            <option value={FailureMode.NETWORK}>Network drop</option>
            <option value={FailureMode.TIMEOUT}>Timeout after commit</option>
            <option value={FailureMode.FUNDS}>Declined (funds)</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Force number</span>
          <select
            value={m.forceNumber === null ? '' : String(m.forceNumber)}
            onChange={(e) => provider.update({ forceNumber: e.target.value === '' ? null : Number(e.target.value) })}
            data-testid="force"
          >
            <option value="">Random</option>
            {Array.from({ length: 37 }, (_, n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          if (seed.trim()) provider.update({ seed: seed.trim() });
        }}
      >
        <span className="field__label">
          Server seed <output className="field__value mono">#{seedFingerprint(m.seed)}</output>
        </span>
        <span className="field__pair">
          <input className="input" value={seed} onChange={(e) => setSeed(e.target.value)} aria-label="Server seed" spellCheck={false} />
          <button type="submit" className="btn btn--ghost btn--sm">
            Apply
          </button>
        </span>
      </form>
      <dl className="kv">
        <dt>Requests</dt>
        <dd>{st.spins}</dd>
        <dt>Committed rounds</dt>
        <dd>{st.committed}</dd>
        <dt>Server wallet</dt>
        <dd>{formatMoney(st.balance)}</dd>
      </dl>
    </section>
  );
}

function RendererSection({ view }: { readonly view: WheelView | null }) {
  const [d, setD] = useState<WheelDebug | null>(null);
  useEffect(() => {
    if (!view) return;
    const t = window.setInterval(() => setD(view.debug()), 250);
    return () => window.clearInterval(t);
  }, [view]);
  return (
    <section className="insp">
      <h3 className="insp__title">Renderer</h3>
      <dl className="kv" data-testid="renderer">
        <dt>Phase</dt>
        <dd data-testid="wheel-phase">{d?.phase ?? '—'}</dd>
        <dt>Pocket under ball</dt>
        <dd data-testid="under-ball">{d?.underBall ?? '—'}</dd>
        <dt>Frame</dt>
        <dd data-testid="fps" data-fps={d ? d.frame.fps.toFixed(1) : ''}>
          {d ? `${d.frame.fps.toFixed(0)} fps · avg ${d.frame.avgMs.toFixed(1)} ms · p95 ${d.frame.p95Ms.toFixed(1)} ms` : '—'}
        </dd>
        <dt>ω wheel / ball</dt>
        <dd>{d ? `${d.wheelVel.toFixed(2)} / ${d.ballVel.toFixed(2)} rad/s` : '—'}</dd>
      </dl>
    </section>
  );
}

function OutcomeSection() {
  const s = useSnapshot();
  const o = s.lastOutcome;
  return (
    <section className="insp">
      <h3 className="insp__title">Last outcome</h3>
      {o ? (
        <pre className="json" data-testid="outcome-json">
          {JSON.stringify(
            {
              roundId: o.roundId,
              number: o.number,
              replayed: o.replayed,
              seed: o.seedFingerprint,
              stake: o.settlement.totalStake,
              returned: o.settlement.totalReturned,
              net: o.settlement.net,
              balanceBefore: o.balanceBefore,
              balanceAfter: o.balanceAfter,
              spots: o.settlement.spots.map((x) => `${x.spotId}:${x.stake}${x.won ? `→${x.returned}` : ''}`),
            },
            null,
            2,
          )}
        </pre>
      ) : (
        <p className="muted small">No rounds yet.</p>
      )}
    </section>
  );
}

function LogSection() {
  const { log } = useSnapshot();
  const rows = log.slice(-60).reverse();
  return (
    <section className="insp">
      <h3 className="insp__title">Event log</h3>
      <table className="log" data-testid="log">
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className={`log--${e.kind}`}>
              <td className="log__t">{clockTime(e.t)}</td>
              <td className="log__e">
                {e.event}
                {e.to ? <span className="log__arrow"> → {e.to}</span> : null}
              </td>
              <td className="log__d">{e.detail ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
