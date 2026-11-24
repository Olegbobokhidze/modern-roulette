import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { GameContext, createGame } from './ui/game';
import './ui/styles/tokens.css';
import './ui/styles/app.css';

const game = createGame(window.location.search);
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <GameContext.Provider value={game}>
      <App />
    </GameContext.Provider>
  </StrictMode>,
);
