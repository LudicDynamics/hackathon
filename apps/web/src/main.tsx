import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { GateThreshold } from './components/performance/GateThreshold.js';
import './index.css';
import './prototype.css';
import './scene-shell.css';
import './decoration.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <GateThreshold />
  </React.StrictMode>,
);
