import { useGame, useSnapshot } from '../game';
import { Sheet } from './Sheet';

const TITLES = {
  NETWORK: 'Connection interrupted',
  TIMEOUT: 'Confirming your round',
  INSUFFICIENT_FUNDS: 'Bets declined',
  INVALID_BET: 'Bets declined',
} as const;

export function ErrorDialog() {
  const { controller } = useGame();
  const s = useSnapshot();
  const e = s.error;
  if (s.state !== 'ERROR' || !e) return null;

  return (
    <Sheet
      open
      variant="modal"
      kicker={`Round ${s.roundId ?? ''} · ${e.code}`}
      title={TITLES[e.code]}
      className="error-dialog"
      footer={
        <>
          {e.dismissible && (
            <button type="button" className={`btn ${e.retryable ? 'btn--ghost' : 'btn--primary'}`} onClick={() => controller.dismissError()} data-testid="dismiss" data-autofocus={!e.retryable || undefined}>
              Return to table
            </button>
          )}
          {e.retryable && (
            <button type="button" className="btn btn--primary" onClick={() => controller.retry()} data-testid="retry" data-autofocus>
              {e.dismissible ? 'Try again' : 'Confirm round'}
            </button>
          )}
        </>
      }
    >
      <p className="error-dialog__msg">{e.message}</p>
      {!e.dismissible && <p className="muted small">Retrying uses the same round id, so the server replays the committed result rather than charging twice.</p>}
    </Sheet>
  );
}
