import { useCallback, useEffect, useState } from 'react';
import { CHIPS } from '../config/game';
import type { WheelView } from '../renderer/wheel-view';
import { BettingTable } from './components/BettingTable';
import { Dock } from './components/Dock';
import { ErrorDialog } from './components/ErrorDialog';
import { Header } from './components/Header';
import { HistoryStrip } from './components/HistoryStrip';
import { Inspector } from './components/Inspector';
import { RulesSheet } from './components/RulesSheet';
import { Toast } from './components/Toast';
import { WheelPanel } from './components/WheelPanel';
import { useGame, useMedia, useSnapshot } from './game';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(t.tagName));

export function App() {
  const game = useGame();
  const { controller, sound } = game;
  const snap = useSnapshot();
  const [chip, setChip] = useState<number>(CHIPS[1]?.value ?? 500);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(game.initialInspector);
  const [view, setView] = useState<WheelView | null>(null);
  const portrait = useMedia('(max-width: 760px) and (orientation: portrait)');
  const modalOpen = rulesOpen || snap.state === 'ERROR';

  // Audio unlocks on the first gesture and pauses in background tabs.
  useEffect(() => {
    const unlock = () => sound.unlock();
    const vis = () => sound.setPageVisible(document.visibilityState === 'visible');
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [sound]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`') {
        e.preventDefault();
        setInspectorOpen((v) => !v);
        return;
      }
      if (modalOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        controller.undo();
        return;
      }
      if (isTyping(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) controller.spin();
        return;
      }
      const c = CHIPS.find((x) => x.key === e.key);
      if (c && !e.ctrlKey && !e.metaKey && !e.altKey) setChip(c.value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, modalOpen]);

  const toggleInspector = useCallback(() => setInspectorOpen((v) => !v), []);

  return (
    <div className="app" data-state={snap.state} data-inspector={inspectorOpen ? 'open' : 'closed'}>
      <Header onRules={() => setRulesOpen(true)} onInspector={toggleInspector} inspectorOpen={inspectorOpen} />
      <main className="main">
        <div className="main__wheel">
          <WheelPanel onView={setView} />
          <HistoryStrip />
        </div>
        <BettingTable chip={chip} orientation={portrait ? 'portrait' : 'landscape'} />
      </main>
      <Dock chip={chip} onChip={setChip} />
      <Toast />
      <Inspector open={inspectorOpen} onClose={() => setInspectorOpen(false)} view={view} />
      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <ErrorDialog />
    </div>
  );
}
