import { useEffect, useRef } from 'react';
import { TABLE_LIMITS } from '../../config/bets';
import { colorOf } from '../../config/wheel';
import { WheelView } from '../../renderer/wheel-view';
import { formatMoney, formatShort, formatSigned } from '../format';
import { useGame, useSnapshot } from '../game';

/** Mounts the canvas renderer once and hands it to the controller as its WheelPort. */
export function WheelPanel({ onView }: { readonly onView: (v: WheelView | null) => void }) {
  const { controller, sound, landingMs, reducedMotion } = useGame();
  const host = useRef<HTMLDivElement>(null);
  const onViewRef = useRef(onView);
  useEffect(() => {
    onViewRef.current = onView;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const view = new WheelView(el, {
      reducedMotion,
      landingMs,
      onSound: (e) => {
        if (e.type === 'launch') sound.launch();
        else if (e.type === 'tick') sound.tick(e.strength);
        else if (e.type === 'land') sound.land();
        else sound.setRoll(e.level);
      },
    });
    controller.attachWheel(view);
    onViewRef.current(view);
    return () => {
      controller.attachWheel(null);
      onViewRef.current(null);
      sound.setRoll(0);
      view.destroy();
    };
  }, [controller, sound, landingMs, reducedMotion]);

  return (
    <section className="wheel-panel" aria-label="Wheel">
      <div className="wheel" ref={host} />
      <ResultReadout />
    </section>
  );
}

function ResultReadout() {
  const s = useSnapshot();
  const r = s.lastResult;

  if (s.state === 'RESULT' && r) {
    const n = r.number;
    const traits = n === 0 ? ['Zero'] : [r.color === 'red' ? 'Red' : 'Black', n % 2 ? 'Odd' : 'Even', n <= 18 ? '1–18' : '19–36'];
    const net = r.settlement.net;
    return (
      <div className="readout is-result" aria-live="polite" data-testid="result" data-number={n}>
        <span className={`readout__number pocket--${colorOf(n)}`}>{n}</span>
        <div className="readout__text">
          <span className="readout__title">{traits.join(' · ')}</span>
          <span className={`readout__sub ${net > 0 ? 'is-win' : ''}`}>
            {r.settlement.totalReturned > 0 ? (
              <>
                <span className="nowrap">
                  {net > 0 ? 'You win' : 'Returned'} {formatMoney(r.settlement.totalReturned)}
                </span>{' '}
                <span className="nowrap">· {formatSigned(net)}</span>
              </>
            ) : (
              'No win this round'
            )}
          </span>
        </div>
      </div>
    );
  }

  const [title, sub] =
    s.state === 'REQUESTING'
      ? ['No more bets', 'Confirming with the table…']
      : s.state === 'SPINNING'
        ? ['No more bets', 'Ball in motion']
        : s.state === 'ERROR'
          ? ['Round paused', 'Waiting on the table']
          : ['Place your bets', `Chips from ${formatShort(TABLE_LIMITS.minSpot)} · up to ${formatShort(TABLE_LIMITS.maxRound)} a round`];

  return (
    <div className={`readout is-${s.state.toLowerCase()}`} aria-live="polite" data-testid="result" data-number="">
      <span className="readout__dot" aria-hidden="true" />
      <div className="readout__text">
        <span className="readout__title">{title}</span>
        <span className="readout__sub">{sub}</span>
      </div>
    </div>
  );
}
