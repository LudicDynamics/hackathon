import React, { useEffect, useMemo, useRef } from 'react';
import { CanvasObject, clearAllLifts, pruneLifts, raiseObject } from './CanvasObject.js';
import { LinkLayer, highlightLinks, updateAllLinks } from './LinkLayer.js';
import { useCamera } from '../../state/useCamera.js';
import { clampZ, zoomAt } from '../../lib/camera.js';
import { makeBox, pushFrom, relaxAll } from '../../lib/collide.js';
import { unlock, playFoley } from '../../lib/audio.js';
import type { LayerItem, LayerLink } from '../../state/useWorld.js';

interface CanvasProps {
  currentLayer: string;
  items: LayerItem[];
  links: LayerLink[];
  characters: Array<{
    id: string;
    avatar?: string;
    bio?: string;
  }>;
  onMoveCard?: (path: string, x: number, y: number) => Promise<void> | void;
  onSelectChoice?: (choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (targetLayer: string) => void;
  onOpenCharacterModal?: (charId: string) => void;
  onItemDropOnTarget?: (itemPath: string, targetPath: string) => void;
  onDropItemToScene?: (itemPath: string) => void;
}

/** Viewport blank-space pan/pinch session (cards never start one). */
interface PanDragState {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  moved: number;
  objectHit: boolean;
}

/**
 * Card drag session — the viewport's pointer handlers drive this state machine
 * (plan §6.2: all pointer logic in the single viewport handler; CanvasObject
 * roots never attach their own listeners). Capture is taken only after the
 * 4px gate passes, so a bare click on a card (choice/dice/gate) is never
 * retargeted away from its interactive child.
 */
interface CardDragSession {
  pointerId: number;
  el: HTMLElement;
  path: string;
  sx: number;
  sy: number;
  ix: number;
  iy: number;
  moved: boolean;
  captured: boolean;
  pushed: Set<HTMLElement>;
}

function readLeft(el: HTMLElement): number {
  const raw = el.style.left ? parseFloat(el.style.left) : NaN;
  return Number.isFinite(raw) ? raw : el.offsetLeft || 0;
}

function readTop(el: HTMLElement): number {
  const raw = el.style.top ? parseFloat(el.style.top) : NaN;
  return Number.isFinite(raw) ? raw : el.offsetTop || 0;
}

function elSize(el: HTMLElement): { w: number; h: number } {
  return {
    w: parseFloat(el.style.width) || el.offsetWidth || 280,
    h: parseFloat(el.style.height) || el.offsetHeight || 180,
  };
}

export const Canvas: React.FC<CanvasProps> = ({
  currentLayer,
  items,
  links,
  characters,
  onMoveCard,
  onSelectChoice,
  onDiceRolled,
  onEnterGate,
  onOpenCharacterModal,
  onItemDropOnTarget,
  onDropItemToScene,
}) => {
  const camera = useCamera();

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d: number; z: number } | null>(null);
  const dragRef = useRef<PanDragState | null>(null);
  const cardDragRef = useRef<CardDragSession | null>(null);
  const paperSlideRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const prevLayerRef = useRef<string | null>(null);

  const readmePath = currentLayer === 'map' ? 'world/README.md' : `${currentLayer}/README.md`;
  const itemsByPath = useMemo(() => new Map(items.map((it) => [it.path, it])), [items]);

  // Camera follows the layer: remember where we leave one, return to the other.
  useEffect(() => {
    const prev = prevLayerRef.current;
    prevLayerRef.current = currentLayer;
    if (prev !== null) {
      camera.save(prev);
      camera.restore(currentLayer);
    }
  }, [currentLayer, camera]);

  // Session z-lifts die with the payload that carries the server order: the
  // `links` array reference only changes on fetchLayer-driven refreshes (never
  // on optimistic moveCard merges), so it is the "server order restored" signal.
  useEffect(() => {
    clearAllLifts();
  }, [links]);

  // Cards that left the layer can no longer hold a lift.
  useEffect(() => {
    pruneLifts(new Set(items.map((it) => it.path)));
  }, [items]);

  // Wheel zoom anchored at the cursor.
  // NOTE: React's synthetic onWheel attaches passively at the root since React 17,
  // so preventDefault() there is silently ignored by the browser. Attach a real
  // non-passive listener instead (same pattern as the v3 prototype).
  useEffect(() => {
    const el = camera.viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { w, h } = camera.getViewport();
      // Anchor off the commanded target (not the displayed current): Chrome may
      // deliver one wheel gesture as several events, and target-anchored steps
      // compose exactly with zero drift regardless of how the gesture is split.
      const next = zoomAt(sx, sy, w, h, camera.getTarget(), e.deltaY);
      camera.flyTo(next.x, next.y, next.z);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [camera]);

  // ---- Card drag (T0.3) ----
  const handlePointerDown = (e: React.PointerEvent) => {
    void unlock(); // idempotent: any interaction start resumes the audio context
    const target = e.target as HTMLElement;
    const obj = target.closest('.object');
    if (obj) {
      const el = obj as HTMLElement;
      if (cardDragRef.current) return; // one drag at a time
      const path = el.dataset.path ?? '';
      if (path === readmePath) return; // the layer's own README is drag-locked
      if (target.closest('button, a, input, select, textarea, [data-no-drag]')) {
        return; // interactive child: plain click, no drag session
      }
      const item = itemsByPath.get(path);
      cardDragRef.current = {
        pointerId: e.pointerId,
        el,
        path,
        sx: e.clientX,
        sy: e.clientY,
        ix: readLeft(el),
        iy: readTop(el),
        moved: false,
        captured: false,
        pushed: new Set(),
      };
      raiseObject(path, el, item?.z ?? 1);
      el.classList.add('dragging-item');
      highlightLinks(path, true);
      e.preventDefault();
      return;
    }

    // Blank viewport → pan + pinch (unchanged from T0.2).
    // Viewport-level interactive UI (character pills) must never start a pan
    // nor be capture-retargeted — capture would swallow their click.
    if (target.closest('.viewport-ui')) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic/replayed pointers have no active pointer id; pan still works */
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        z: camera.getCam().z,
      };
      dragRef.current = null;
      return;
    }
    const camNow = camera.getCam();
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      cx: camNow.x,
      cy: camNow.y,
      moved: 0,
      objectHit: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = cardDragRef.current;
    if (s && e.pointerId === s.pointerId) {
      const dx = e.clientX - s.sx;
      const dy = e.clientY - s.sy;
      if (!s.moved) {
        if (Math.hypot(dx, dy) <= 4) return; // 4px gate: small jitter ≠ drag
        s.moved = true;
        try {
          s.el.setPointerCapture(e.pointerId);
          s.captured = true;
        } catch {
          /* capture is best-effort; bubbling still reaches the viewport */
        }
      }
      // Pointer→world conversion goes exclusively through cam.z (plan §6.8②).
      const z = camera.getCam().z;
      const x = s.ix + dx / z;
      const y = s.iy + dy / z;
      s.el.style.left = `${x}px`;
      s.el.style.top = `${y}px`;

      // Paper-slide foley while dragging: ~80ms throttle, intensity follows
      // the instantaneous pointer speed (a slow scoot is a soft whisper).
      const now = performance.now();
      const slide = paperSlideRef.current;
      if (!slide) {
        paperSlideRef.current = { t: now, x: e.clientX, y: e.clientY };
      } else if (now - slide.t >= 80) {
        const dt = Math.max(1, now - slide.t);
        const spd = Math.hypot(e.clientX - slide.x, e.clientY - slide.y) / dt;
        playFoley('paper-slide', Math.min(1, spd / 2));
        paperSlideRef.current = { t: now, x: e.clientX, y: e.clientY };
      }

      // Soft push of neighbours (pure math, direct DOM writes).
      const view = camera.viewportRef.current;
      if (view) {
        const dragBox = makeBox(x, y, elSize(s.el).w, elSize(s.el).h);
        const others: HTMLElement[] = [];
        view.querySelectorAll<HTMLElement>('.object').forEach((el) => {
          if (el !== s.el) others.push(el);
        });
        const boxes = others.map((el) =>
          makeBox(readLeft(el), readTop(el), elSize(el).w, elSize(el).h)
        );
        for (const p of pushFrom(dragBox, boxes)) {
          const o = others[p.i];
          o.classList.add('pushed');
          o.style.left = `${readLeft(o) + p.dx}px`;
          o.style.top = `${readTop(o) + p.dy}px`;
          s.pushed.add(o);
        }
      }
      highlightLinks(s.path, true); // keep asserted while dragging
      updateAllLinks();
      return;
    }

    // Pan + pinch (existing).
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 0) {
        const now = camera.getCam();
        camera.flyTo(now.x, now.y, clampZ(pinchRef.current.z * (dist / pinchRef.current.d)));
      }
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    if (d.moved > 4) {
      const z = camera.getCam().z;
      camera.flyTo(d.cx - dx / z, d.cy - dy / z);
    }
  };

  /** Finish a card drag: relax residual overlap, persist moved cards, clean up. */
  const settleDrag = (s: CardDragSession, persist: boolean) => {
    if (persist && s.moved) {
      playFoley('bag-pack'); // drop thud once the card settles
      const view = camera.viewportRef.current;
      if (view) {
        const els: HTMLElement[] = [];
        view.querySelectorAll<HTMLElement>('.object').forEach((el) => els.push(el));
        const boxes = els.map((el) =>
          makeBox(readLeft(el), readTop(el), elSize(el).w, elSize(el).h)
        );
        const relax = relaxAll(boxes);
        for (const r of relax) {
          const el = els[r.i];
          el.classList.add('pushed');
          el.style.left = `${readLeft(el) + r.dx}px`;
          el.style.top = `${readTop(el) + r.dy}px`;
          s.pushed.add(el);
        }
        // Relax settled the layout past the last pointermove: refresh the links.
        updateAllLinks();
        // Persist every card whose final position differs from React state —
        // the dragged card AND every pushed/relaxed card (plan §6.8③).
        if (onMoveCard) {
          for (const el of els) {
            const p = el.dataset.path;
            if (!p) continue;
            const orig = itemsByPath.get(p);
            if (!orig) continue;
            const fx = readLeft(el);
            const fy = readTop(el);
            if (Math.abs(fx - orig.x) > 0.5 || Math.abs(fy - orig.y) > 0.5) {
              void onMoveCard(p, fx, fy);
            }
          }
        }
      }
      highlightLinks(s.path, false);
    }
    s.el.classList.remove('dragging-item');
    cardDragRef.current = null;
    window.setTimeout(() => {
      for (const el of s.pushed) el.classList.remove('pushed');
    }, 260);
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    const s = cardDragRef.current;
    if (s && e.pointerId === s.pointerId) {
      settleDrag(s, true);
      return;
    }
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    dragRef.current = null;
    // Pointer capture releases automatically on pointerup.
  };

  // Cancel = abort gesture; no persistence, no highlight/class fallout.
  const handlePointerCancel = (e: React.PointerEvent) => {
    const s = cardDragRef.current;
    if (s && e.pointerId === s.pointerId) {
      settleDrag(s, false);
      return;
    }
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    dragRef.current = null;
  };

  // HTML5 drop of a backpack item onto blank scene space (backpack→card stays
  // inside CardRenderer's own drop handlers; CanvasObject is not draggable).
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const itemPath = e.dataTransfer.getData('text/plain');
    if (itemPath && onDropItemToScene) {
      onDropItemToScene(itemPath);
    }
  };

  return (
    <div
      ref={camera.viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="relative w-full h-full overflow-hidden canvas-grid cursor-grab active:cursor-grabbing select-none touch-none"
    >
      {/* Character pill row — pinned to the viewport (not scaled by the world
          transform) so the role entries keep working at any zoom (T1.5
          replaces this with spatial presence halos). */}
      {characters && characters.length > 0 && (
        <div className="viewport-ui absolute top-4 left-1/2 -translate-x-1/2 z-30 flex gap-4">
          {characters.map((char) => (
            <div
              key={char.id}
              onClick={() => onOpenCharacterModal?.(char.id)}
              className="group cursor-pointer flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-paper-card border border-ink/10 shadow-halo hover:scale-105 transition-all"
            >
              <img
                src={char.avatar || '/assets/characters/portraits/lady_1.png'}
                alt={char.id}
                className="w-8 h-8 rounded-full object-cover border border-rust/20"
              />
              <span className="text-xs font-bold text-ink group-hover:text-rust transition-colors">
                {char.id}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* World Transform Layer — single transform layer, rAF writes transform.
          Must pin transform-origin to top-left: default is center, which would
          offset every screen↔world mapping by half the content size. */}
      <div ref={camera.worldRef} className="absolute left-0 top-0 origin-top-left">
        <LinkLayer links={links} />

        {/* Layer Header Tag */}
        <div className="mb-8 inline-block px-4 py-1.5 rounded-full bg-paper-card/80 border border-ink/10 shadow-soft backdrop-blur-md">
          <span className="font-mono text-xs text-ink/50 uppercase tracking-widest">
            ACTIVE LAYER:
          </span>{' '}
          <span className="font-sans font-bold text-ink text-xs">{currentLayer}</span>
        </div>

        {/* Cards — absolutely positioned at server-seated coords (no flex wrapper). */}
        {items.map((item) => (
          <CanvasObject
            key={item.path}
            item={item}
            readmePath={readmePath}
            onSelectChoice={onSelectChoice}
            onDiceRolled={onDiceRolled}
            onEnterGate={onEnterGate}
            onOpenCharacterModal={onOpenCharacterModal}
            onItemDropOnTarget={onItemDropOnTarget}
          />
        ))}
      </div>
    </div>
  );
};
