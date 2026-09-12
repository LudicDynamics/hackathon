import React, { useEffect, useMemo, useRef } from 'react';
import { CanvasObject, clearAllLifts, pruneLifts, raiseObject } from './CanvasObject.js';
import { LinkLayer, highlightLinks, updateAllLinks } from './LinkLayer.js';
import { CanvasGrid } from './CanvasGrid.js';
import { SceneBackdrop } from './SceneBackdrop.js';
import { ParticleLayer } from './ParticleLayer.js';
import { useCamera } from '../../state/useCamera.js';
import { clampZ, zoomAt, screenToWorld } from '../../lib/camera.js';
import { makeBox, pushFrom, relaxAll } from '../../lib/collide.js';
import { unlock, playFoley } from '../../lib/audio.js';
import { separateBounds } from '../../lib/ui-shell.mjs';
import { elementBox, invalidateMeasures } from '../../lib/measure.js';
import { setParallax } from '../../lib/parallax.js';
import type { LayerItem, LayerLink } from '../../state/useWorld.js';

interface CanvasProps {
  openingComposition?: boolean;
  effectsEnabled?: boolean;
  currentLayer: string;
  items: LayerItem[];
  links: LayerLink[];
  bg: { src: string | null; tone: string; grain: string };
  onMoveCard?: (path: string, x: number, y: number) => Promise<void> | void;
  onSelectChoice?: (choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (targetLayer: string) => void;
  onOpenCharacterModal?: (charId: string) => void;
  onItemDropOnTarget?: (itemPath: string, targetPath: string) => void;
  onDropItemToScene?: (itemPath: string) => void;
  onOpenRadialMenu?: (x: number, y: number, worldX: number, worldY: number) => void;
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



export const Canvas: React.FC<CanvasProps> = ({
  openingComposition = false,
  effectsEnabled = false,
  currentLayer,
  items,
  links,
  bg,
  onMoveCard,
  onSelectChoice,
  onDiceRolled,
  onEnterGate,
  onOpenCharacterModal,
  onItemDropOnTarget,
  onDropItemToScene,
  onOpenRadialMenu,
}) => {
  const camera = useCamera();


  useEffect(() => { if (!effectsEnabled) setParallax(0, 0); }, [effectsEnabled]);

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d: number; z: number } | null>(null);
  const dragRef = useRef<PanDragState | null>(null);
  const cardDragRef = useRef<CardDragSession | null>(null);
  const paperSlideRef = useRef<{ t: number; x: number; y: number } | null>(null);
  // Viewport client rect, cached across pointermoves (it only changes on
  // resize). See handlePointerMove.
  const viewportRectRef = useRef<{ vp: HTMLElement; r: DOMRect } | null>(null);
  const prevLayerRef = useRef<string | null>(null);
  const framedLayers = useRef(new Set<string>());
  const itemsByPath = useMemo(() => new Map(items.map((it) => [it.path, it])), [items]);
  // Ordinal seal number per gate (01, 02, …) — the scene's position among the
  // gates of THIS layer, derived from server order so it is stable across
  // refreshes. CardRenderer falls back to this when frontmatter has no order/n.
  const gateOrdinal = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const it of items) if (it.kind === 'gate') map.set(it.path, ++n);
    return map;
  }, [items]);


  // Camera follows the layer: remember where we leave one, return to the other.
  useEffect(() => {
    const prev = prevLayerRef.current;
    prevLayerRef.current = currentLayer;
    if (prev !== null) {
      camera.save(prev);
      camera.restore(currentLayer);
    }
  }, [currentLayer, camera]);

  // Frame real rendered bounds once per scene, preserving subsequent pan/zoom.
  useEffect(() => {
    if (!items.length || framedLayers.current.has(currentLayer)) return;
    let cancelled = false;
    const frame = () => {
      if (cancelled) return;
      const viewport = camera.viewportRef.current;
      const objects = [...(viewport?.querySelectorAll<HTMLElement>('.object') || [])];
      if (!viewport || !objects.length) return;
      const measured = objects.map(el => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: Math.max(el.offsetHeight, el.scrollHeight) }));
      if (openingComposition && currentLayer === 'map') {
        const narration = objects.findIndex(el => el.querySelector('.chalk'));
        if (narration >= 0) {
          const main = measured[narration];
          main.x = 580;
          main.y = 350;
          let rowY = 350;
          let rowHeight = 0;
          let column = 0;
          measured.forEach((box, index) => {
            if (index === narration) return;
            box.x = main.x + main.w + 80 + column * 260;
            box.y = rowY;
            rowHeight = Math.max(rowHeight, box.h);
            if (++column === 2) { column = 0; rowY += rowHeight + 40; rowHeight = 0; }
          });
        }
      }
      const separated = separateBounds(measured);
      framedLayers.current.add(currentLayer);
      separated.forEach((box, index) => {
        const el = objects[index];
        if (box.y === el.offsetTop && box.x === el.offsetLeft) return;
        el.style.left = `${box.x}px`;
        el.style.top = `${box.y}px`;
        if (el.dataset.path) void onMoveCard?.(el.dataset.path, box.x, box.y);
      });
      const left = Math.min(...objects.map(el => el.offsetLeft));
      const top = Math.min(...objects.map(el => el.offsetTop));
      const right = Math.max(...objects.map(el => el.offsetLeft + el.offsetWidth));
      const bottom = Math.max(...objects.map(el => el.offsetTop + Math.max(el.offsetHeight, el.scrollHeight)));
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      const topSpace = width < 700 ? 175 : 110;
      const bottomSpace = width < 700 ? 170 : 130;
      const z = Math.min(.95, (width - (width < 700 ? 95 : 220)) / Math.max(1, right - left), (height - topSpace - bottomSpace) / Math.max(1, bottom - top));
      camera.flyTo((left + right) / 2, (top + bottom) / 2 + (bottomSpace - topSpace) / (2 * z), z);
    };
    void document.fonts.ready.then(() => requestAnimationFrame(frame));
    return () => { cancelled = true; };
  }, [currentLayer, items, camera, openingComposition]);

  // Session z-lifts die with the payload that carries the server order: the
  // `links` array reference only changes on fetchLayer-driven refreshes (never
  // on optimistic moveCard merges), so it is the "server order restored" signal.
  useEffect(() => {
    clearAllLifts();
  }, [links]);

  // Card rendered sizes are cached during a drag; a layer refresh can change
  // them, so drop the cache whenever the payload (or viewport) changes.
  useEffect(() => {
    invalidateMeasures();
  }, [items, links]);

  // Cards that left the layer can no longer hold a lift.
  useEffect(() => {
    pruneLifts(new Set(items.map((it) => it.path)));
  }, [items]);

  // Any viewport resize changes both card layout and the cached client rect.
  useEffect(() => {
    const onResize = () => {
      invalidateMeasures();
      viewportRectRef.current = null;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    // 2.5D parallax tracking: publish normalized [-1,1] coordinates to the
    // module store. Consumers (backdrop, particles) read it imperatively —
    // this used to be setState, re-rendering the whole canvas subtree on every
    // mouse move (cost grew with card count). The viewport rect is cached:
    // it only changes on resize, and reading it here forced a layout on every
    // move (profile: getBoundingClientRect 120× per 120 moves).
    const vp = camera.viewportRef.current;
    if (vp && effectsEnabled) {
      let rect = viewportRectRef.current;
      if (!rect || rect.vp !== vp) {
        rect = { vp, r: vp.getBoundingClientRect() };
        viewportRectRef.current = rect;
      }
      const { width, height, left, top } = rect.r;
      if (width > 0 && height > 0) {
        const nx = ((e.clientX - left) / width - 0.5) * 2;
        const ny = ((e.clientY - top) / height - 0.5) * 2;
        setParallax(nx, ny);
      }
    }

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

      // Soft push of neighbours (pure math, direct DOM writes). Boxes come
      // from the measure cache — reading offsetHeight here forced a reflow of
      // the doc on every move (profile: `get offsetHeight` ≈ 6×/move).
      const view = camera.viewportRef.current;
      if (view) {
        const self = elementBox(s.el);
        const dragBox = makeBox(x, y, self.w, self.h);
        const others: HTMLElement[] = [];
        view.querySelectorAll<HTMLElement>('.object').forEach((el) => {
          if (el !== s.el) others.push(el);
        });
        const boxes = others.map((el) => {
          const b = elementBox(el);
          return makeBox(b.l, b.t, b.w, b.h);
        });
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
        const boxes = els.map((el) => {
          const b = elementBox(el);
          return makeBox(b.l, b.t, b.w, b.h);
        });
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

  // World Studio: Right-click on blank canvas summons the Radial Creator Menu
  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.object') || target.closest('button, a, input')) {
      return; // Clicking on cards or interactive elements retains native/local behavior
    }
    e.preventDefault();
    const el = camera.viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { w, h } = camera.getViewport();
    const cam = camera.getCam();
    const worldCoord = screenToWorld(sx, sy, w, h, cam);

    playFoley('paper-slide', 0.8);
    onOpenRadialMenu?.(e.clientX, e.clientY, worldCoord.x, worldCoord.y);
  };

  return (
    <div
      ref={camera.viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      onContextMenu={handleContextMenu}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
      style={{ perspective: '1200px' }}
    >
      {/* 2.5D Background sheet with 0.25x parallax drift & video support */}
      <SceneBackdrop bg={bg} effectsEnabled={effectsEnabled} />

      {/* World Transform Layer — single transform layer, rAF writes transform.
          Must pin transform-origin to top-left: default is center, which would
          offset every screen↔world mapping by half the content size. */}
      <div ref={camera.worldRef} className="absolute left-0 top-0 origin-top-left">
        <LinkLayer links={links} />
        {/* World-locked 80px hairlines; sized to one viewport, not 6000px. */}
        <CanvasGrid camera={camera} />

        {/* Cards — absolutely positioned at server-seated coords (no flex wrapper).
            `index` is the gate's ordinal among this layer's gates (01, 02, …). */}
        {items.map((item) => (
          <CanvasObject
            key={item.path}
            item={item}
            index={gateOrdinal.get(item.path)}
            onSelectChoice={onSelectChoice}
            onDiceRolled={onDiceRolled}
            onEnterGate={onEnterGate}
            onOpenCharacterModal={onOpenCharacterModal}
            onItemDropOnTarget={onItemDropOnTarget}
          />
        ))}
      </div>

      {/* Atmospheric 1.35x foreground particle system: floating dust & rain overlay */}
      {effectsEnabled && <ParticleLayer key={bg.tone} tone={bg.tone} />}
    </div>
  );
};
