/**
 * HintBar.tsx — the always-on key/mouse cheat sheet (prototype #hint, L529).
 * Display only: no state, no handlers. Copy is English per the language rule.
 */
import React from 'react';

export interface HintBarProps {
  /** Override the default hint line (e.g. a layer-specific variant). */
  text?: string;
}

export const DEFAULT_HINT =
  'Drag to pan · Scroll to zoom · Click a door to enter · Alt+← / Esc to return · Type below to ask the writer';

export const HintBar: React.FC<HintBarProps> = ({ text = DEFAULT_HINT }) => (
  <div className="hint-bar">{text}</div>
);
