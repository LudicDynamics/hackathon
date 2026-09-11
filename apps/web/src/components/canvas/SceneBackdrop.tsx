import React, { useState } from 'react';
import { materialSkinOf } from '@airp/shared/forms';

/** The layer backdrop payload from `GET /api/layer` (see LayerState.bg). */
export interface SceneBackdropBg {
  /** World-relative asset path (`assets/scenes/<layer>/<file>.png`), or null. */
  src: string | null;
  /** Ambient tone (audio bed selection; carried through for CSS hooks). */
  tone: string;
  /** Material skin key — `parchment` | `warm` | `stub` | `kraft`. */
  grain: string;
}

export interface SceneBackdropProps {
  bg: SceneBackdropBg;
}

/**
 * The layer's "paper" fills the viewport: a material skin (always present) →
 * optional painted scene image → warm-ink edge vignette. It sits behind the
 * camera viewport (`absolute inset 0`, `z-0`, `pointer-events: none`), so it
 * never intercepts canvas clicks.
 *
 * Asset routing: `bg.src` is world-relative; the server serves it via
 * `GET /api/asset?path=<world-relative>` (404 when absent, 403 on traversal).
 * Templates ship no `assets/` directory, so the request misses and `onError`
 * drops the `<img>` — the material skin alone carries the scene. We deliberately
 * use `<img>` (not `background-image: url()`) so a missing asset is observable
 * and degrades gracefully instead of failing silently.
 *
 * `failedSrc` (not a boolean) is tracked so switching to a new layer's image
 * retries the fetch rather than inheriting the previous layer's failure.
 */
export const SceneBackdrop: React.FC<SceneBackdropProps> = ({ bg }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = bg.src;
  const showImg = !!src && failedSrc !== src;

  return (
    <div className={`scene-backdrop ${materialSkinOf(bg.grain)}`} data-tone={bg.tone}>
      {showImg && (
        <img
          className="scene-backdrop__img"
          src={`/api/asset?path=${encodeURIComponent(src)}`}
          alt=""
          onError={() => setFailedSrc(src)}
        />
      )}
      <div className="scene-backdrop__vignette" />
    </div>
  );
};
