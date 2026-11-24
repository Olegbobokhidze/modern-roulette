import { CHIPS } from '../../config/game';
import { chipLabel, formatMoney } from '../format';
import { useCountUp, useGame, useSnapshot } from '../game';
import { IconClear, IconDouble, IconRebet, IconUndo } from './icons';

type Props = { readonly chip: number; readonly onChip: (v: number) => void };

/** Chip rack, stake, secondary actions, and the primary Spin at the far right. */
export function Dock({ chip, onChip }: Props) {
  const { controller } = useGame();
  const s = useSnapshot();
  const staked = useCountUp(s.staked, 300);
  const busy = s.state === 'REQUESTING' || s.state === 'SPINNING';
  const spinLabel = busy ? 'Spinning' : s.state === 'RESULT' ? 'Spin again' : 'Spin';

  return (
    <div className="dock" role="toolbar" aria-label="Betting controls">
      <div className="chips" role="radiogroup" aria-label="Chip value">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={chip === c.value}
            className={`chip chip--${c.tone} ${chip === c.value ? 'is-selected' : ''}`}
            onClick={() => onChip(c.value)}
            aria-label={`${formatMoney(c.value)} chip (key ${c.key})`}
            data-testid={`chip-${c.value}`}
          >
            <span className="chip__face">{chipLabel(c.value)}</span>
          </button>
        ))}
      </div>

      <div className="figure figure--stake">
        <span className="figure__label">Total bet</span>
        <output className="figure__value" data-testid="stake" data-value={s.staked}>
          {formatMoney(staked)}
        </output>
      </div>

      <div className="dock__actions">
        <button type="button" className="btn btn--ghost" onClick={() => controller.undo()} disabled={!s.canUndo} data-testid="undo" aria-keyshortcuts="Control+Z">
          <IconUndo />
          <span>Undo</span>
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => controller.clear()} disabled={!s.canClear} data-testid="clear">
          <IconClear />
          <span>Clear</span>
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => controller.rebet()} disabled={!s.canRebet} data-testid="rebet">
          <IconRebet />
          <span>Rebet</span>
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => controller.double()} disabled={!s.canDouble} data-testid="double">
          <IconDouble />
          <span>2×</span>
        </button>
      </div>

      <button
        type="button"
        className={`btn btn--primary btn--spin ${busy ? 'is-busy' : ''}`}
        onClick={() => controller.spin()}
        disabled={!s.canSpin}
        data-testid="spin"
        aria-keyshortcuts="Space"
      >
        <span className="btn--spin__ring" aria-hidden="true" />
        {spinLabel}
      </button>
    </div>
  );
}
