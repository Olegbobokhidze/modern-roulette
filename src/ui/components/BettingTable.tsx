import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { BET_KINDS } from '../../config/bets';
import { CHIPS } from '../../config/game';
import { POCKET_COUNT, colorOf } from '../../config/wheel';
import { isFeltOpen } from '../../engine/machine';
import type { SpotResult } from '../../engine/payout';
import { SPOTS, getSpot, type BetSpot, type SpotId } from '../../engine/spots';
import { chipLabel, formatMoney, formatShort } from '../format';
import { useGame, useMedia, useSnapshot } from '../game';
import { isHotspot, spotRect, toPercent, type Orientation } from '../table-geometry';

const OUTSIDE_LABEL: Partial<Record<string, string>> = {
  'dozen:1': '1st 12',
  'dozen:2': '2nd 12',
  'dozen:3': '3rd 12',
  'column:1': '2:1',
  'column:2': '2:1',
  'column:3': '2:1',
  low: '1–18',
  high: '19–36',
  even: 'Even',
  odd: 'Odd',
};

const straights = SPOTS.filter((s) => s.kind === 'straight');
const outside = SPOTS.filter((s) => !BET_KINDS[s.kind].inside);
const hotspots = SPOTS.filter(isHotspot);

export const chipTone = (amount: number): string => [...CHIPS].reverse().find((c) => amount >= c.value)?.tone ?? CHIPS[0]?.tone ?? 'bone';

type Props = { readonly chip: number; readonly orientation: Orientation };

export function BettingTable({ chip, orientation }: Props) {
  const { controller } = useGame();
  const snap = useSnapshot();
  const coarse = useMedia('(pointer: coarse)');
  const hot = coarse ? 0.46 : 0.34;
  const [preview, setPreview] = useState<SpotId | null>(null);

  const open = isFeltOpen(snap.state);
  const result = snap.state === 'RESULT' ? snap.lastResult : null;
  const outcomes = useMemo(() => new Map<SpotId, SpotResult>((result?.settlement.spots ?? []).map((r) => [r.spotId, r])), [result]);
  const previewSpot = preview ? getSpot(preview) : undefined;
  const covered = new Set(previewSpot?.numbers ?? []);

  const box = (s: BetSpot): CSSProperties => toPercent(spotRect(s, orientation, hot), orientation);
  const centre = (s: BetSpot): CSSProperties => {
    const r = spotRect(s, orientation, hot);
    // Long outside spots (dozens, even money) take their stack toward the far end, so the label stays readable.
    const long = !BET_KINDS[s.kind].inside && s.kind !== 'column';
    const fx = long && r.w > r.h ? 0.82 : 0.5;
    const fy = long && r.h > r.w ? 0.87 : 0.5;
    const p = toPercent({ x: r.x + r.w * fx, y: r.y + r.h * fy, w: 0, h: 0 }, orientation);
    return { left: p.left, top: p.top };
  };

  const handlers = (s: BetSpot) => ({
    onClick: () => controller.place(s.id, chip),
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      controller.remove(s.id);
    },
    onPointerEnter: () => setPreview(s.id),
    onPointerLeave: () => setPreview((p) => (p === s.id ? null : p)),
    onFocus: () => setPreview(s.id),
    onBlur: () => setPreview((p) => (p === s.id ? null : p)),
    'data-spot': s.id,
    'aria-disabled': !open || undefined,
  });

  return (
    <section className="table-panel" aria-label="Betting table">
      <div className={`felt felt--${orientation} ${open ? '' : 'is-closed'} ${preview ? 'has-preview' : ''}`} data-testid="felt">
        {straights.map((s) => {
          const n = s.numbers[0] ?? 0;
          const cls = [
            'cell',
            'cell--number',
            `pocket--${colorOf(n)}`,
            n === 0 ? 'cell--zero' : '',
            covered.has(n) ? 'is-covered' : '',
            result?.number === n ? 'is-winner' : '',
          ].join(' ');
          return (
            <button key={s.id} type="button" className={cls} style={box(s)} aria-label={`${s.label}, pays 35 to 1`} {...handlers(s)}>
              <span className="cell__num">{n}</span>
            </button>
          );
        })}

        {outside.map((s) => {
          const win = result && s.numbers.includes(result.number);
          const cls = ['cell', 'cell--outside', `cell--${s.kind}`, preview === s.id ? 'is-covered' : '', win ? 'is-winner' : ''].join(' ');
          return (
            <button key={s.id} type="button" className={cls} style={box(s)} aria-label={`${s.label}, pays ${BET_KINDS[s.kind].payout} to 1`} {...handlers(s)}>
              {s.kind === 'red' || s.kind === 'black' ? (
                <span className={`diamond diamond--${s.kind}`} aria-hidden="true" />
              ) : (
                <span className="cell__label">{OUTSIDE_LABEL[s.id] ?? s.label}</span>
              )}
            </button>
          );
        })}

        {hotspots.map((s) => (
          <button
            key={s.id}
            type="button"
            tabIndex={-1}
            className={`hot ${preview === s.id ? 'is-active' : ''}`}
            style={box(s)}
            aria-label={`${s.label}, pays ${BET_KINDS[s.kind].payout} to 1`}
            {...handlers(s)}
          >
            <span className="hot__dot" aria-hidden="true" />
          </button>
        ))}

        {Object.entries(snap.bets).map(([id, amount]) => {
          const s = getSpot(id);
          if (!s) return null;
          const o = outcomes.get(id);
          const state = o ? (o.won ? 'is-won' : 'is-lost') : '';
          return (
            <span key={id} className={`stack chip--${chipTone(amount)} ${state}`} style={centre(s)} data-testid="stack" data-spot={id} data-amount={amount}>
              <span className="stack__face">{chipLabel(amount)}</span>
            </span>
          );
        })}
      </div>
      <PreviewLine spot={previewSpot} chip={chip} stake={preview ? snap.bets[preview] ?? 0 : 0} outcome={preview ? outcomes.get(preview) : undefined} touch={coarse} />
    </section>
  );
}

type PreviewProps = {
  readonly spot: BetSpot | undefined;
  readonly chip: number;
  readonly stake: number;
  readonly outcome: SpotResult | undefined;
  readonly touch: boolean;
};

function PreviewLine({ spot, chip, stake, outcome, touch }: PreviewProps) {
  if (!spot) {
    return (
      <p className="preview is-hint" data-testid="preview">
        {touch ? 'Tap a spot to place a chip. Edges and corners take split and corner bets.' : 'Hover or focus a spot to see what it covers. Right-click a stack to remove it.'}
      </p>
    );
  }
  const spec = BET_KINDS[spot.kind];
  const pct = ((spot.numbers.length / POCKET_COUNT) * 100).toFixed(1);
  const list = spot.numbers.length <= 6 ? spot.numbers.join(' · ') : `${spot.numbers.length} numbers`;
  return (
    <p className="preview" data-testid="preview" aria-live="polite">
      <span className="preview__name">{spot.label}</span>
      <span className="preview__sep" aria-hidden="true" />
      <span>{list}</span>
      <span className="preview__sep" aria-hidden="true" />
      <span>
        pays <b>{spec.payout}:1</b>
      </span>
      <span className="preview__sep" aria-hidden="true" />
      <span>
        {spot.numbers.length}/{POCKET_COUNT} · {pct}%
      </span>
      <span className="preview__sep" aria-hidden="true" />
      {outcome ? (
        <span className={outcome.won ? 'preview__won' : 'preview__muted'}>
          {outcome.won ? `Won ${formatMoney(outcome.returned)} on ${formatMoney(outcome.stake)}` : `Lost ${formatMoney(outcome.stake)}`}
        </span>
      ) : (
        <span className="preview__muted">
          {formatShort(chip)} returns {formatMoney(chip * (spec.payout + 1))}
          {stake > 0 ? ` · on spot ${formatMoney(stake)}` : ''} · max {formatShort(spec.maxStake)}
        </span>
      )}
    </p>
  );
}
