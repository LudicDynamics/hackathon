import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { WorldShelf } from '../lib/airp-gateway.js';
import { useLocale } from '../lib/i18n.js';
import { useStill } from '../lib/motion.js';
import { brickGeometry, brickWorld, editionLabel, launcherWorlds, visibleBricks, worldTitle } from '../lib/world-launcher.js';
import './world-launcher.css';

const LANGUAGES = [['ja', '日本語'], ['zh-CN', '中文'], ['en', 'English']] as const;
/** Movement below this is a click on a brick, not a drag of the wall. */
const DRAG_THRESHOLD = 6;
/** A release after holding still this long does not glide. */
const GLIDE_WINDOW_MS = 80;
/** Fastest glide after a fling, px/ms: a flick must not throw the wall a million pixels. */
const MAX_GLIDE_SPEED = 3;
const clampSpeed = (value: number) => Math.max(-MAX_GLIDE_SPEED, Math.min(MAX_GLIDE_SPEED, value));

/**
 * The world launcher (docs/ui/世界Launcher.md): an endless wall of thick glass
 * bricks, one world per brick, repeating in every direction. Scroll, drag or use
 * the arrow keys to wander; the wall leans with the pointer. Every session starts
 * here and every world returns here.
 */
export function WorldLauncher({ shelf, loading, onLoad, onClose, onManageSaves }: {
  shelf: WorldShelf;
  loading: string | null;
  onLoad: (path: string) => void;
  /** Present while a world is open: go back into it. */
  onClose?: () => void;
  onManageSaves: () => void;
}) {
  const { t, locale, setLocale } = useLocale();
  const still = useStill();
  const worlds = useMemo(() => launcherWorlds(shelf.groups ?? [], locale), [shelf.groups, locale]);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const geometry = useMemo(() => brickGeometry(size.w), [size.w]);
  const cellW = geometry.w + geometry.gap;
  const cellH = geometry.h + geometry.gap;
  // Pan position (the wall point at the stage's top-left). Moving it touches
  // only the layer's transform; React re-renders when a brick boundary is crossed.
  const pan = useRef<{ x: number; y: number } | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; t: number; vx: number; vy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const tiltFrame = useRef(0);
  const glide = useRef(0);
  const active = opened ?? hovered;

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => setSize({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const place = useCallback(() => {
    const at = pan.current;
    if (!at || !layer.current) return;
    layer.current.style.transform = `translate3d(${-at.x}px, ${-at.y}px, 0)`;
    const x = Math.floor(at.x / cellW) * cellW;
    const y = Math.floor(at.y / cellH) * cellH;
    setAnchor(previous => (previous.x === x && previous.y === y ? previous : { x, y }));
  }, [cellW, cellH]);

  // Open centred on the first world.
  useLayoutEffect(() => {
    if (pan.current === null && size.w > 0) pan.current = { x: geometry.w / 2 - size.w / 2, y: geometry.h / 2 - size.h / 2 };
    place();
  }, [geometry, size, place]);

  const panBy = useCallback((dx: number, dy: number) => {
    if (!pan.current) return;
    pan.current.x += dx;
    pan.current.y += dy;
    place();
  }, [place]);

  useEffect(() => () => { cancelAnimationFrame(tiltFrame.current); cancelAnimationFrame(glide.current); }, []);

  // Wheel and trackpad: both axes at once, so the wall scrolls in any direction.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cancelAnimationFrame(glide.current);
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      panBy(event.deltaX * unit, event.deltaY * unit);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [panBy]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = { ArrowLeft: [-cellW / 2, 0], ArrowRight: [cellW / 2, 0], ArrowUp: [0, -cellH / 2], ArrowDown: [0, cellH / 2] }[event.key];
      if (step && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        panBy(step[0], step[1]);
      } else if (event.key === 'Escape') {
        if (opened) setOpened(null);
        else if (onClose) onClose();
        else return;
      } else {
        return;
      }
      // The world underneath has its own Escape and arrow keys.
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [cellW, cellH, onClose, opened, panBy]);

  // Lean is written to CSS variables, not React state.
  const lean = (x: number, y: number) => {
    cancelAnimationFrame(tiltFrame.current);
    tiltFrame.current = requestAnimationFrame(() => {
      root.current?.style.setProperty('--tilt-x', x.toFixed(3));
      root.current?.style.setProperty('--tilt-y', y.toFixed(3));
    });
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    cancelAnimationFrame(glide.current);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), vx: 0, vy: 0, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (current && current.id === event.pointerId) {
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        current.moved = true;
        suppressClick.current = true;
        setDragging(true);
        setHovered(null);
        stage.current?.setPointerCapture(event.pointerId);
      }
      if (current.moved) {
        const now = performance.now();
        const dt = Math.max(8, now - current.t);
        current.vx = clampSpeed(-dx / dt);
        current.vy = clampSpeed(-dy / dt);
        panBy(-dx, -dy);
        current.x = event.clientX;
        current.y = event.clientY;
        current.t = now;
      }
    }
    if (!still && event.pointerType !== 'touch') {
      lean((event.clientX / window.innerWidth - 0.5) * 2, (event.clientY / window.innerHeight - 0.5) * 2);
    }
  };
  const onPointerUp = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (!current.moved) return;
    setDragging(false);
    // The click that follows this release belongs to the drag, not to a brick.
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    if (still || performance.now() - current.t > GLIDE_WINDOW_MS) return;
    let { vx, vy } = current;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      panBy(vx * dt, vy * dt);
      const decay = Math.pow(0.94, dt / 16);
      vx *= decay;
      vy *= decay;
      if (Math.hypot(vx, vy) > 0.02) glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  };

  const bricks = useMemo(
    () => visibleBricks(anchor.x, anchor.y, size.w + cellW, size.h + cellH, geometry, 1),
    [anchor, size, geometry, cellW, cellH],
  );

  return (
    <div
      ref={root}
      className={`world-launcher${dragging ? ' is-dragging' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('World launcher')}
      onPointerMove={onPointerMove}
      onPointerLeave={() => lean(0, 0)}
    >
      <div className="world-launcher__ambient" aria-hidden="true" style={{ '--count': worlds.length || 1 } as React.CSSProperties}>
        {worlds.map(world => <span key={world.id} style={{ backgroundImage: `url("${world.cover}")` }} />)}
      </div>
      <header className="world-launcher__top">
        <span className="world-launcher__brand">World<span>lines</span></span>
        <div className="world-launcher__langs" role="group" aria-label={t('Language')}>
          {LANGUAGES.map(([code, label]) => (
            <button key={code} type="button" aria-pressed={locale === code} onClick={() => setLocale(code)}>{label}</button>
          ))}
        </div>
        <nav aria-label={t('World launcher')}>
          <button type="button" className="world-launcher__pill" onClick={onManageSaves}>{t('Saved games')}</button>
          {onClose && <button type="button" className="world-launcher__pill" onClick={onClose}>{t('Continue this story')}</button>}
        </nav>
      </header>
      <div
        ref={stage}
        className="world-launcher__stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={event => {
          if (!suppressClick.current) return;
          event.stopPropagation();
          event.preventDefault();
        }}
      >
        <div className="world-launcher__tilt">
          <div ref={layer} className="world-launcher__layer">
            {worlds.length > 0 && bricks.map(brick => {
              const index = brickWorld(brick.col, brick.row, worlds.length);
              const world = worlds[index];
              const key = `${brick.col}:${brick.row}`;
              const title = worldTitle(world.name);
              const latest = world.saves[0];
              const isOpen = opened === key;
              const current = world.saves.some(save => save.active);
              const cover = { backgroundImage: `url("${world.cover}")` };
              return (
                <article
                  key={key}
                  className={`world-launcher__tile${active === key ? ' is-active' : ''}`}
                  style={{ left: brick.left, top: brick.top, width: geometry.w, height: geometry.h }}
                  onPointerEnter={() => { if (!drag.current?.moved) setHovered(key); }}
                  onPointerLeave={() => setHovered(value => (value === key ? null : value))}
                >
                  <span className="world-launcher__image" style={cover} aria-hidden="true" />
                  {/* The slab's thick edge: the same picture, magnified, seen only in a band. */}
                  <span className="world-launcher__rim" aria-hidden="true"><span style={cover} /></span>
                  <span className="world-launcher__fringe" aria-hidden="true" />
                  <span className="world-launcher__sheen" aria-hidden="true" />
                  <button
                    type="button"
                    className="world-launcher__hit"
                    aria-expanded={isOpen}
                    aria-label={title}
                    onClick={() => setOpened(isOpen ? null : key)}
                    onFocus={() => setHovered(key)}
                  />
                  <span className="world-launcher__meta" aria-hidden="true">
                    <span><i>{String(index + 1).padStart(2, '0')}</i>{editionLabel(world.locale)}</span>
                    <span>{current ? t('Current game') : t('{count} saves', { count: world.saves.length })}</span>
                  </span>
                  <div className="world-launcher__caption">
                    <b>{title}</b>
                    {world.description && <small>{world.description}</small>}
                    {isOpen && (
                      <div className="world-launcher__actions">
                        {latest && (
                          <button type="button" disabled={loading !== null} onClick={() => onLoad(latest.path)}>
                            {t('Continue latest save')}{loading === latest.path ? t(' · opening…') : ''}
                          </button>
                        )}
                        <button type="button" disabled={loading !== null} onClick={() => onLoad(world.templatePath!)}>
                          {t('＋ Start a new game')}{loading === world.templatePath ? t(' · opening…') : ''}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      <p className="world-launcher__hint" aria-hidden="true">{t('Drag or scroll to wander')}</p>
    </div>
  );
}
