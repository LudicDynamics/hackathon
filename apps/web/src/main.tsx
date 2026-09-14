// Must run before any module that builds `/api` or `/ws` URLs.
import './lib/base-path.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { unlockOnFirstInteraction } from './lib/audio.js';
import './index.css';
import './prototype.css';
import './scene-shell.css';
import './decoration.css';

// Autoplay policy: resume audio on the first gesture anywhere, not only on the
// canvas — otherwise theme/BGM stay silent after clicking chrome controls.
unlockOnFirstInteraction();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
