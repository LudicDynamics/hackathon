import React from 'react';
import { BagItemDialog } from '../BagItemDialog.js';
import { PhotoDetailDialog } from '../photo/PhotoDetailDialog.js';
import { CardRenderer } from './CardRenderer.js';
import { highlightLinks } from './LinkLayer.js';
import { chalkStyleOf } from '@airp/shared/forms';
import { appearanceViewOf } from '../../lib/appearance-view.js';
import type { LayerItem } from '../../state/useWorld.js';
import { UserRound } from 'lucide-react';
import { EntityInteractions } from '../narrative/EntityInteractions.js';
import { highlightChalkAnchor } from '../../lib/chalk-anchor.js';
import { airpGateway, type AssetMediaKind } from '../../lib/airp-gateway.js';

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
const SpriteFig: React.FC<{ avatar?: string; video?: string; name: string; still: boolean }> = ({ avatar, video, name, still }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [avatar]);
  const src = avatar && (/^(?:https?:|data:|blob:)/.test(avatar) ? avatar : assetUrl(avatar, 'image'));
  return <div className="presence-orb" role="img" aria-label={name}>
    {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : <UserRound size={30} strokeWidth={1.3} aria-hidden="true" />}
  </div>;
};

/** World-root-relative asset path → URL (contract §5.4, same as SceneBackdrop). */
const assetUrl = (p: string, mediaKind: AssetMediaKind): string => {
  if (p.startsWith('/api/asset')) {
    const url = new URL(p, 'http://airp.local');
    const assetPath = url.searchParams.get('path');
    return assetPath ? airpGateway.assetUrl(assetPath, undefined, mediaKind) : '';
  }
  return airpGateway.assetUrl(p.replace(/^\/+/, ''), undefined, mediaKind);
};

interface PortraitProps {
  video?: string;
  poster?: string;
  caption?: string;
  /** Visible end of the fallback chain when nothing decodes. */
  title: string;
  /** true = never mount <video> (L1 cap / L3 reduced motion — nook 03 §③-6). */
  still: boolean;
}

/**
 * A living portrait: a looping silent alpha clip with a still fallback.
 * `failedSrc` is a string, not a boolean, so a changed `video:`/`poster:` value
 * resets the fallback automatically (SceneBackdrop.tsx:29-33, same paradigm).
 * The `<video>` / `<img>` are mutually exclusive branches of ONE ternary:
 * `document.hidden` unmounts the element entirely, so a poster `<img>` must be
 * re-created there rather than relying on the vanished `<video poster=>`.
 */
const PortraitFig: React.FC<PortraitProps> = ({ video, poster, caption, title, still }) => {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const [visible, setVisible] = React.useState(() => !document.hidden);

  React.useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const videoOk = !!video && !still && failedSrc !== video;
  const posterOk = !!poster && failedSrc !== poster;

  return (
    <div className="portrait" data-title={title}>
      <div className="portrait__media">
        {videoOk ? (
          visible ? (
            <video
              className="portrait__video"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster={posterOk ? assetUrl(poster!, 'image') : undefined}
              src={assetUrl(video!, 'video')}
              onError={() => setFailedSrc(video!)}
            />
          ) : posterOk ? (
            <img
              className="portrait__still"
              src={assetUrl(poster!, 'image')}
              alt=""
              onError={() => setFailedSrc(poster!)}
            />
          ) : null
        ) : posterOk ? (
          <img
            className="portrait__still"
            src={assetUrl(poster!, 'image')}
            alt=""
            onError={() => setFailedSrc(poster!)}
          />
        ) : (
          <div className="portrait__missing" role="img" aria-label={title}>
            <span>{title}</span>
          </div>
        )}
      </div>
      {caption && <div className="portrait__caption">{caption}</div>}
    </div>
  );
};

export interface CanvasObjectProps {
  item: LayerItem;
  /** true = this card never mounts <video> (L1 cap / L3 reduced motion, nook 03 §③-6). */
  still?: boolean;
  index?: number;
  onSelectChoice?: (path: string, choice: string) => void;
  onEntityAction?: (prompt: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (targetLayer: string) => void;
  onOpenCharacterModal?: (charId: string) => void;
  onItemDropOnTarget?: (itemPath: string, targetPath: string) => void;
  onTakeItem?: (path: string) => void;
}

/** `--target-rot` is a CSS custom property, which `CSSProperties` cannot name. */
type ShellStyle = React.CSSProperties & { '--target-rot': string };

/**
 * The shell owns position, declared width and rotation. Height is left to the
 * content so the painted box IS the real box (chalk overruns `form.h`).
 * Rotation belongs to the shell alone: narration (chalk) and the presence
 * figure stay level, every paper form keeps its hand tilt (AGENTS §7.5③).
 */
function shellStyle(item: CanvasObjectProps['item'], kind: string, reading: boolean): ShellStyle {
  return {
    left: item.x,
    top: item.y,
    // Declared width only — the reading panel floats (prop-card.css) so it never
    // grows the shell. Mutating width here was a 4th collision authority
    // (docs/footprint §3.5, AGENTS §7.5①).
    width: item.w,
    zIndex: reading ? 'var(--depth-entity-reading)' : liftFor(item.path, item.z),
    '--target-rot': kind === 'chalk' || kind === 'sprite' ? '0deg' : `${item.rot}deg`,
  };
}
export const CanvasObject: React.FC<CanvasObjectProps> = ({
  item,
  still = false,
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
  const objectRef = React.useRef<HTMLDivElement>(null);
  // Verified resolution → trusted attrs/vars (docs/components/04 §:79). Memoised in the
  // adapter, so re-renders cost nothing; a missing resolution simply means legacy defaults.
  const appearance = item.appearance ? appearanceViewOf(item.appearance) : null;
  const isGate = kind === 'gate' || item.frontmatter?.type === 'gate' || item.path.endsWith('/README.md');
  const readable = kind !== 'sprite' && !isGate;
  const isPhoto = kind === 'photo' && item.frontmatter?.component === 'photo';
  const photoDialogId = `photo-detail-${item.path.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [isItemDragging, setIsItemDragging] = React.useState(false);
  const anchorCleanup = React.useRef<(() => void) | undefined>(undefined);
  const enterPendingKey = React.useRef<string | null>(null);
  const enterPendingTimer = React.useRef<number | null>(null);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => () => {
    anchorCleanup.current?.();
    clearTimeout(enterPendingTimer.current ?? undefined);
    enterPendingTimer.current = null;
    enterPendingKey.current = null;
  }, [item.path, item.frontmatter?.anchor]);
  const highlight = (element: HTMLElement, active: boolean) => {
    highlightLinks(item.path, active);
    anchorCleanup.current?.();
    anchorCleanup.current = undefined;
    if (active && item.frontmatter?.type === 'chalk') {
      anchorCleanup.current = highlightChalkAnchor(element, item.path, item.frontmatter.anchor);
    }
  };
  const gateTarget = typeof item.frontmatter?.target === 'string' && item.frontmatter.target.trim()
    ? item.frontmatter.target
    : item.path.replace(/\/README\.md$/, '');
  const requestEnter = (target: string) => {
    if (enterPendingKey.current === target) return;
    clearTimeout(enterPendingTimer.current ?? undefined);
    enterPendingKey.current = target;
    enterPendingTimer.current = window.setTimeout(() => {
      enterPendingKey.current = null;
      enterPendingTimer.current = null;
    }, 500);
    onEnterGate?.(target);
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
    if (draggedPath) onItemDropOnTarget?.(draggedPath, item.path);
  };
  const spritePuzzleClasses = `${isItemDragging ? 'puzzle-target-ready' : ''} ${isDragOver ? 'puzzle-target-hover' : ''}`.trim();

  return (
    <div
      ref={objectRef}
      data-path={item.path}
      tabIndex={0}
      aria-label={isPhoto ? String(item.frontmatter?.title || item.filename) : undefined}
      aria-expanded={isPhoto ? reading : undefined}
      aria-controls={isPhoto && reading ? photoDialogId : undefined}
      onPointerDownCapture={event => { pointerStart.current = { x: event.clientX, y: event.clientY }; }}
      onClick={event => {
        if (!readable || (event.target as HTMLElement).closest('button,a,input,textarea,select,.entity-interactions,.cabin-prop,[role="dialog"]')) return;
        if (Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 6) return;
        setReading(value => !value);
      }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          if (isGate) {
            requestEnter(gateTarget);
          } else if (readable) {
            setReading(value => !value);
          }
        }
      }}
      onPointerEnter={event => { setHovered(true); highlight(event.currentTarget, true); }}
      onPointerLeave={event => { setHovered(false); highlight(event.currentTarget, false); }}
      onFocus={event => { setFocused(true); highlight(event.currentTarget, true); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { setFocused(false); highlight(event.currentTarget, false); } }}
      className={`object ink-form${reading ? ' object--reading' : ''}`}
      data-reading={reading ? '' : undefined}
      // Appearance attrs/vars are additive: `shellStyle` still owns position/width/
      // zIndex/rotation alone (docs/components/04 §:79). Siblings inherit the vars.
      {...appearance?.attrs}
      style={{ ...appearance?.style, ...shellStyle(item, kind, reading) }}
    >
        {reading && isPhoto ? (
          <PhotoDetailDialog
            item={item}
            appearance={appearance}
            dialogId={photoDialogId}
            onClose={() => setReading(false)}
            returnFocusRef={objectRef}
          />
        ) : reading ? (
          <BagItemDialog inline item={item} appearance={appearance} onClose={() => setReading(false)} />
        ) : kind === 'portrait' ? (
          <PortraitFig
            video={item.frontmatter?.video}
            poster={item.frontmatter?.poster}
            caption={item.frontmatter?.caption}
            title={item.frontmatter?.title || item.filename.replace('.md', '')}
            still={still}
          />
        ) : kind === 'sprite' ? (
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
            <SpriteFig avatar={item.frontmatter?.avatar} video={item.frontmatter?.avatarVideo} still={still} name={item.frontmatter?.title || item.filename.replace('.md', '')} />
            <div className="sprite__name">
              {item.frontmatter?.title || item.filename.replace('.md', '')}
            </div>
          </div>
        ) : (
          <CardRenderer
            item={item}
            appearance={appearance}
            index={index}
            onSelectChoice={onSelectChoice}
            onDiceRolled={onDiceRolled}
            onEnterGate={onEnterGate ? requestEnter : undefined}
            onOpenCharacterModal={onOpenCharacterModal}
            onItemDropOnTarget={onItemDropOnTarget}
            onTakeItem={onTakeItem}
          />
        )}
        {!reading && <EntityInteractions item={item} active={hovered || focused} onChoice={onEntityAction} onDiceRolled={onDiceRolled} onEnterGate={onEnterGate ? requestEnter : undefined} onOpenCharacter={onOpenCharacterModal} />}
    </div>
  );
};
