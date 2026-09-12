/**
 * HintBar.tsx — the key/mouse cheat sheet (prototype #hint, L529).
 *
 * Collapsed by default to a small "?" chip so the bottom strip never competes
 * with the writer input for width (they share the bottom edge). Click to
 * expand the full line; clicking again collapses. Copy is English per the
 * language rule.
 */
import React, { useState } from 'react';

export interface HintBarProps {
  /** Override the default hint line (e.g. a layer-specific variant). */
  text?: string;
  showLabel?: string;
  hideLabel?: string;
}

export const DEFAULT_HINT =
  'Drag to pan · Scroll to zoom · Click a door to enter · Alt+← / Esc to return · Type below to ask the writer';

export const HintBar: React.FC<HintBarProps> = ({
  text = DEFAULT_HINT,
  showLabel = 'Show controls help',
  hideLabel = 'Hide controls help',
}) => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="hint-bar hint-bar--chip"
        title={text}
        aria-label={showLabel}
        onClick={() => setOpen(true)}
      >
        ?
      </button>
    );
  }

  return (
    <button
      type="button"
      className="hint-bar"
      title={hideLabel}
      onClick={() => setOpen(false)}
    >
      {text}
    </button>
  );
};
