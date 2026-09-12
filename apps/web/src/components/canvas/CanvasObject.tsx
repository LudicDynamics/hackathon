import React from 'react';
import { createPortal } from 'react-dom';
import { BagItemDialog } from '../BagItemDialog.js';
import { CardRenderer } from './CardRenderer.js';
import { highlightLinks } from './LinkLayer.js';
import { chalkStyleOf } from '@airp/shared/forms';
import type { LayerItem } from '../../state/useWorld.js';
import { UserRound } from 'lucide-react';
import { EntityInteractions } from '../narrative/EntityInteractions.js';
import { highlightChalkAnchor } from '../../lib/chalk-anchor.js';
import { airpGateway } from '../../lib/airp-gateway.js';

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
const SpriteFig: React.FC<{ avatar?: string; name: string }> = ({ avatar, name }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [avatar]);
  const src = avatar && (/^(?:https?:|data:|blob:|\/)/.test(avatar) ? avatar : airpGateway.assetUrl(avatar));
  return <div className="presence-orb" role="img" aria-label={name}>
    {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : <UserRound size={30} strokeWidth={1.3} aria-hidden="true" />}
  </div>;
};

export interface CanvasObjectProps {
  item: LayerItem;
  /** Ordinal of this gate among the layer's gates (fallback for the seal). */
  index?: number;
  onSelectChoice?: (path: string, choice: string) => void;
  onEntityAction?: (prompt: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (targetLayer: string) => void;
  onOpenCharacterModal?: (charId: string) => void;
  onItemDropOnTarget?: (itemPath: string, targetPath: string) => void;
  onTakeItem?: (path: string) => void;
}

export const CanvasObject: React.FC<CanvasObjectProps> = ({
  item,
  index,
  onSelectChoice,
  onEntityAction,
  onDiceRolled,
  onEnterGate,
  onOpenCharacterModal,
  onItemDropOnTarget,
  onTakeItem,
}) => {
  const kind = item.kind;
  const [reading, setReading] = React.useState(false);
  const pointerStart = React.useRef({ x: 0, y: 0 });
  const readable = kind !== 'sprite' && kind !== 'gate';
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [isItemDragging, setIsItemDragging] = React.useState(false);
  const [isUnlockedEffect, setIsUnlockedEffect] = React.useState(false);
  const anchorCleanup = React.useRef<(() => void) | undefined>(undefined);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => () => anchorCleanup.current?.(), [item.path, item.frontmatter?.anchor]);
  const highlight = (element: HTMLElement, active: boolean) => {
    highlightLinks(item.path, active);
    anchorCleanup.current?.();
    anchorCleanup.current = undefined;
    if (active && item.frontmatter?.type === 'chalk') {
      anchorCleanup.current = highlightChalkAnchor(element, item.path, item.frontmatter.anchor);
    }
  };

  React.useEffect(() => {
    const onDragStart = () => setIsItemDragging(true);
    const onDragEnd = () => {
      setIsItemDragging(false);
      setIsDragOver(false);
    };
    window.addEventListener('airp:item-drag-start', onDragStart);
    window.addEventListener('airp:item-drag-end', onDragEnd);
    return () => {
      window.removeEventListener('airp:item-drag-start', onDragStart);
      window.removeEventListener('airp:item-drag-end', onDragEnd);
    };
  }, []);

  const handleSpriteDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const draggedPath = e.dataTransfer.getData('text/plain');
    if (draggedPath) {
      setIsUnlockedEffect(true);
      setTimeout(() => setIsUnlockedEffect(false), 800);
      onItemDropOnTarget?.(draggedPath, item.path);
    }
  };

  const spritePuzzleClasses = `${isItemDragging ? 'puzzle-target-ready' : ''} ${isDragOver ? 'puzzle-target-hover' : ''} ${isUnlockedEffect ? 'puzzle-unlock-burst' : ''}`.trim();

  return (
    <div
      data-path={item.path}
      tabIndex={0}
      onPointerDownCapture={event => { pointerStart.current = { x: event.clientX, y: event.clientY }; }}
      onClick={event => {
        if (!readable || (event.target as HTMLElement).closest('button,a,input,textarea,select,.entity-interactions,.cabin-prop,[role="dialog"]')) return;
        if (Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 6) return;
        setReading(value => !value);
      }}
      onKeyDown={event => { if (readable && event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); setReading(value => !value); } }}
      onPointerEnter={event => { setHovered(true); highlight(event.currentTarget, true); }}
      onPointerLeave={event => { setHovered(false); highlight(event.currentTarget, false); }}
      onFocus={event => { setFocused(true); highlight(event.currentTarget, true); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { setFocused(false); highlight(event.currentTarget, false); } }}
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
            kind === 'sprite' ? '0deg' : `${item.rot}deg`,
        } as React.CSSProperties
      }
    >
        {kind === 'sprite' ? (
          <div
            onClick={() => {
              const charId = item.frontmatter?.characterId || item.frontmatter?.id || item.filename.replace('.md', '');
              onOpenCharacterModal?.(charId);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleSpriteDrop}
            className={`sprite cursor-pointer transition-transform duration-200 ${chalkStyleOf(item.frontmatter).aged ? ' chalk--aged' : ''} ${spritePuzzleClasses}`}
          >
            <SpriteFig avatar={item.frontmatter?.avatar} name={item.frontmatter?.title || item.filename.replace('.md', '')} />
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
            onTakeItem={onTakeItem}
          />
        )}
        <EntityInteractions item={item} active={hovered || focused} onChoice={onEntityAction} onDiceRolled={onDiceRolled} onEnterGate={onEnterGate} onOpenCharacter={onOpenCharacterModal} />
        {reading && createPortal(<BagItemDialog item={item} onClose={() => setReading(false)} />, document.body)}
    </div>
  );
};
