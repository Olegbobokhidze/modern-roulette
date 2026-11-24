import { colorOf } from '../../config/wheel';
import { useSnapshot } from '../game';

const SHOWN = 16;

/** Recent numbers, newest first, plus a hairline red / black / zero split of the session. */
export function HistoryStrip() {
  const { history } = useSnapshot();
  const n = history.length;
  const reds = history.filter((x) => colorOf(x) === 'red').length;
  const zeros = history.filter((x) => x === 0).length;
  const pct = (k: number) => (n ? Math.round((k / n) * 100) : 0);

  return (
    <section className="history" aria-label="Recent numbers">
      <span className="history__label">Recent</span>
      <ol className="history__list" data-testid="history">
        {n === 0 && <li className="history__empty">No spins yet</li>}
        {history.slice(0, SHOWN).map((x, i) => (
          <li key={n - i} className={`history__item pocket--${colorOf(x)} ${i === 0 ? 'is-latest' : ''}`} aria-label={`${x} ${colorOf(x)}`}>
            {x}
          </li>
        ))}
      </ol>
      {n > 0 && (
        <div className="history__split" title={`Last ${n}: ${pct(reds)}% red, ${pct(n - reds - zeros)}% black, ${pct(zeros)}% zero`}>
          <span className="split__bar">
            <span className="split__red" style={{ width: `${(reds / n) * 100}%` }} />
            <span className="split__zero" style={{ width: `${(zeros / n) * 100}%` }} />
          </span>
          <span className="split__legend">
            <span className="split__key split__key--red" aria-hidden="true" />
            {pct(reds)}%
            <span className="split__key split__key--black" aria-hidden="true" />
            {pct(n - reds - zeros)}%
            <span className="split__key split__key--green" aria-hidden="true" />
            {pct(zeros)}%
          </span>
        </div>
      )}
    </section>
  );
}
