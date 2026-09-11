import React from 'react';
import { CardRenderer } from './CardRenderer.js';
import { highlightLinks } from './LinkLayer.js';
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

export interface CanvasObjectProps {
  item: LayerItem;
  /** Path of the current layer's own README — that card is drag-locked (plan §6.3). */
  readmePath: string | null;
  onSelectChoice?: (choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (targetLayer: string) => void;
  onOpenCharacterModal?: (charId: string) => void;
  onItemDropOnTarget?: (itemPath: string, targetPath: string) => void;
}

export const CanvasObject: React.FC<CanvasObjectProps> = ({
  item,
  readmePath,
  onSelectChoice,
  onDiceRolled,
  onEnterGate,
  onOpenCharacterModal,
  onItemDropOnTarget,
}) => {
  const locked = item.path === readmePath;

  return (
    <div
      data-path={item.path}
      onPointerEnter={() => highlightLinks(item.path, true)}
      onPointerLeave={() => highlightLinks(item.path, false)}
      className={`object${locked ? ' object-locked' : ''}`}
      style={
        {
          left: item.x,
          top: item.y,
          width: item.w,
          height: item.h,
          zIndex: liftFor(item.path, item.z),
          ['--target-rot' as any]: `${item.rot}deg`,
        } as React.CSSProperties
      }
    >
      <CardRenderer
        item={item}
        onSelectChoice={onSelectChoice}
        onDiceRolled={onDiceRolled}
        onEnterGate={onEnterGate}
        onOpenCharacterModal={onOpenCharacterModal}
        onItemDropOnTarget={onItemDropOnTarget}
      />
    </div>
  );
};
