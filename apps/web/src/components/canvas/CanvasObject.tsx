import React from 'react';
import { CardRenderer } from './CardRenderer.js';
import { highlightLinks } from './LinkLayer.js';
import { chalkStyleOf } from '@airp/shared/forms';
import type { LayerItem } from '../../state/useWorld.js';

/**
 * Absolute-positioned card shell inside the world transform layer (v2 `.object`
 * semantics). Renders CardRenderer (whose root width comes from `item.w` via
 * `w-full`), rotates by the server-derived `--target-rot`, and exposes
 * `data-path` for the LinkLayer registry.
 *
 * Pointer handling lives ENTIRELY in the viewport (Canvas) dispatcher — this
 * component only hooks hover highlights and the README drag lock (styling).
 * It is deliberately NOT draggable (plan §6.7: HTML5 dnd stays exclusive to
 * backpack sources).
 */

/** Session z-lift registry: path → raised zIndex, survives the drop re-render
 *  (the inline style would otherwise snap back to the server item.z). Cleared
 *  by Canvas on refresh/layer switch (plan §6.9: lift is session-only). */
const LIFTED_Z = new Map<string, number>();
let topZ = 10;

export function liftFor(path: string, z: number): number {
  return LIFTED_Z.get(path) ?? z;
}

/** Raise a card above every other card for the current drag session. */
export function raiseObject(path: string, el: HTMLElement, z: number): void {
  topZ = Math.max(topZ + 1, (Number.isFinite(z) ? z : 1) + 1);
  LIFTED_Z.set(path, topZ);
  el.style.zIndex = String(topZ);
}

export function clearAllLifts(): void {
  LIFTED_Z.clear();
}

export function pruneLifts(paths: Set<string>): void {
  for (const key of LIFTED_Z.keys()) {
    if (!paths.has(key)) LIFTED_Z.delete(key);
  }
}

/** Presence figure — the world's people. Ink sketch + a name strip (proto `.sprite`). */
const SpriteFig: React.FC = () => (
  <div className="sprite__halo">
    <svg
      viewBox="0 0 72 64"
      width={72}
      height={64}
      fill="none"
      stroke="#2B2117"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="36" cy="16" r="11" fill="#FFFEF6" />
      <path d="M22 60 Q22 30 36 30 Q50 30 50 60 Z" fill="#FFFEF6" />
      <path d="M28 44 L44 44" strokeDasharray="3 3" />
      <circle cx="31" cy="15" r="1.2" fill="#2B2117" />
      <circle cx="41" cy="15" r="1.2" fill="#2B2117" />
      <path d="M33 20 q3 2.4 6 0" />
    </svg>
  </div>
);

export interface CanvasObjectProps {
  item: LayerItem;
  /** Ordinal of this gate among the layer's gates (fallback for the seal). */
  index?: number;
  onSelectChoice?: (choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (targetLayer: string) => void;
  onOpenCharacterModal?: (charId: string) => void;
  onItemDropOnTarget?: (itemPath: string, targetPath: string) => void;
}

export const CanvasObject: React.FC<CanvasObjectProps> = ({
  item,
  index,
  onSelectChoice,
  onDiceRolled,
  onEnterGate,
  onOpenCharacterModal,
  onItemDropOnTarget,
}) => {
  const kind = item.kind;

  return (
    <div
      data-path={item.path}
      onPointerEnter={() => highlightLinks(item.path, true)}
      onPointerLeave={() => highlightLinks(item.path, false)}
      className="object ink-form"
      style={
        {
          left: item.x,
          top: item.y,
          width: item.w,
          // No height: the shell hugs its card, so the painted box IS the real
          // box (chalk runs far past form.h and used to overflow the shell).
          zIndex: liftFor(item.path, item.z),
          // Rotation belongs to the shell alone. Narration (chalk) and the
          // presence figure stay level; every paper form keeps its hand tilt.
          ['--target-rot' as any]:
            kind === 'chalk' || kind === 'sprite' ? '0deg' : `${item.rot}deg`,
        } as React.CSSProperties
      }
    >
        {kind === 'sprite' ? (
          <div
            className={`sprite${chalkStyleOf(item.frontmatter).aged ? ' chalk--aged' : ''}`}
          >
            <SpriteFig />
            <div className="sprite__name">
              {item.frontmatter?.title || item.filename.replace('.md', '')}
            </div>
          </div>
        ) : (
          <CardRenderer
            item={item}
            index={index}
            onSelectChoice={onSelectChoice}
            onDiceRolled={onDiceRolled}
            onEnterGate={onEnterGate}
            onOpenCharacterModal={onOpenCharacterModal}
            onItemDropOnTarget={onItemDropOnTarget}
          />
        )}
    </div>
  );
};
