import { useCountUp, useGame, useMuted, useSnapshot } from '../game';
import { formatMoney } from '../format';
import { IconInfo, IconInspector, IconMuted, IconSound } from './icons';

type Props = { readonly onRules: () => void; readonly onInspector: () => void; readonly inspectorOpen: boolean };

export function Header({ onRules, onInspector, inspectorOpen }: Props) {
  const { sound } = useGame();
  const muted = useMuted();
  const snap = useSnapshot();
  const balance = useCountUp(snap.balance);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true" />
        <span className="brand__name">Roulette</span>
        <span className="brand__meta">European · Single zero</span>
      </div>
      <div className="topbar__end">
        <div className="figure figure--balance">
          <span className="figure__label">Balance</span>
          <output className="figure__value" data-testid="balance" data-value={snap.balance} aria-live="polite">
            {formatMoney(balance)}
          </output>
        </div>
        <div className="topbar__tools">
          <button type="button" className="icon-btn" onClick={onRules} aria-label="Rules and payouts">
            <IconInfo />
          </button>
          <button type="button" className="icon-btn" onClick={() => sound.setMuted(!muted)} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted}>
            {muted ? <IconMuted /> : <IconSound />}
          </button>
          <button type="button" className={`icon-btn ${inspectorOpen ? 'is-on' : ''}`} onClick={onInspector} aria-label="Provider inspector" aria-pressed={inspectorOpen}>
            <IconInspector />
          </button>
        </div>
      </div>
    </header>
  );
}
