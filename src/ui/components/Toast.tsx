import { useEffect, useState } from 'react';
import { useSnapshot } from '../game';

/** Brief, polite notices for rejected or adjusted intents (e.g. "Capped at the table limit"). */
export function Toast() {
  const { notice } = useSnapshot();
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!notice) return;
    setShown(notice.id);
    const t = window.setTimeout(() => setShown((id) => (id === notice.id ? null : id)), 2400);
    return () => window.clearTimeout(t);
  }, [notice]);

  const visible = notice && shown === notice.id;
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {visible && (
        <div key={notice.id} className={`toast toast--${notice.tone}`} data-testid="toast">
          {notice.text}
        </div>
      )}
    </div>
  );
}
