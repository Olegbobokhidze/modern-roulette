import { BET_KINDS, TABLE_LIMITS } from '../../config/bets';
import { POCKET_COUNT } from '../../config/wheel';
import { formatShort } from '../format';
import { Sheet } from './Sheet';

const ORDER = ['straight', 'split', 'street', 'trio', 'corner', 'firstFour', 'line', 'dozen', 'column', 'red', 'even', 'low'] as const;
const NAME: Partial<Record<(typeof ORDER)[number], string>> = { red: 'Red / Black', even: 'Even / Odd', low: '1–18 / 19–36' };

export function RulesSheet({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const rtp = ((36 / POCKET_COUNT) * 100).toFixed(2);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="modal"
      kicker="European · single zero"
      title="Rules & payouts"
      className="rules"
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose} data-autofocus>
          Back to table
        </button>
      }
    >
      <table className="paytable">
        <thead>
          <tr>
            <th scope="col">Bet</th>
            <th scope="col" className="num">
              Covers
            </th>
            <th scope="col" className="num">
              Pays
            </th>
            <th scope="col" className="num">
              Max
            </th>
          </tr>
        </thead>
        <tbody>
          {ORDER.map((k) => {
            const s = BET_KINDS[k];
            return (
              <tr key={k}>
                <th scope="row">{NAME[k] ?? s.label}</th>
                <td className="num">{s.coverage}</td>
                <td className="num">{s.payout}:1</td>
                <td className="num">{formatShort(s.maxStake)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="rules__list">
        <li>
          One zero, 37 pockets. Every bet returns {rtp}% over the long run, so the house edge is the same 2.70% whichever spot you choose.
        </li>
        <li>Zero loses all outside bets. There is no la partage or en prison.</li>
        <li>
          Chips from {formatShort(TABLE_LIMITS.minSpot)}, and up to {formatShort(TABLE_LIMITS.maxRound)} a round. A chip that would pass a limit is
          trimmed to fit.
        </li>
        <li>The table server decides each number. The wheel animates to it, and your balance updates once the ball has settled.</li>
      </ul>

      <h3 className="rules__heading">Shortcuts</h3>
      <dl className="kbd-list">
        <div>
          <dt>
            <kbd>Space</kbd>
          </dt>
          <dd>Spin / spin again</dd>
        </div>
        <div>
          <dt>
            <kbd>Ctrl</kbd> <kbd>Z</kbd>
          </dt>
          <dd>Undo last chip</dd>
        </div>
        <div>
          <dt>
            <kbd>1</kbd>–<kbd>5</kbd>
          </dt>
          <dd>Choose chip</dd>
        </div>
        <div>
          <dt>
            <kbd>`</kbd>
          </dt>
          <dd>Provider inspector</dd>
        </div>
      </dl>
      <p className="credit">Designed and built by Oleg Bobokhidze</p>
    </Sheet>
  );
}
