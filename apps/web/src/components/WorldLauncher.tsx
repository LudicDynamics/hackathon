import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { WorldShelf } from '../lib/airp-gateway.js';
import { withBase } from '../lib/base-path.js';
import { useLocale } from '../lib/i18n.js';
import { useStill } from '../lib/motion.js';
import type { FocusCoordinator, FocusSurfaceLease } from '../lib/focus-coordinator.js';
import {
  brickGeometry,
  brickWorld,
  editionLabel,
  LAUNCHER_CREDIT,
  launcherWorlds,
  visibleBricks,
  worldTitle,
  type ShelfGroup,
} from '../lib/world-launcher.js';
import './world-launcher.css';

const LANGUAGES = [['ja', '日本語'], ['zh-CN', '中文'], ['en', 'English']] as const;
/** Movement below this is a click on a brick, not a drag of the wall. */
const DRAG_THRESHOLD = 6;
/** A release after holding still this long does not glide. */
const GLIDE_WINDOW_MS = 80;
/** Fastest glide after a fling, px/ms: a flick must not throw the wall a million pixels. */
const MAX_GLIDE_SPEED = 3;
const clampSpeed = (value: number) => Math.max(-MAX_GLIDE_SPEED, Math.min(MAX_GLIDE_SPEED, value));
/** Wheel and keys ease towards their target: share of the remaining distance per 60fps frame. */
const EASE_PER_FRAME = 0.16;
/** Wheel ticks in quick succession speed the wall up, to at most this factor. */
const MAX_WHEEL_BOOST = 2.2;
/** How many bricks play their world's video at once: those nearest the centre, plus the hovered one. */
const PLAYING_BRICKS = 5;

type Translate = ReturnType<typeof useLocale>['t'];

interface BrickProps {
  brickKey: string;
  world: ShelfGroup;
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  active: boolean;
  open: boolean;
  playing: boolean;
  loading: string | null;
  t: Translate;
  onHover: (key: string | null) => void;
  onToggle: (key: string) => void;
  onLoad: (path: string) => void;
}

/** One glass brick. Memoised: panning mounts and unmounts bricks at the edges only. */
const Brick = memo(function Brick({ brickKey, world, index, left, top, width, height, active, open, playing, loading, t, onHover, onToggle, onLoad }: BrickProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!playing) setReady(false); }, [playing]);
  const title = worldTitle(world.name);
  const latest = world.saves[0];
  const current = world.saves.some(save => save.active);
  const cover = { backgroundImage: `url("${withBase(world.cover)}")` };
  return (
    <article
      className={`world-launcher__tile${active ? ' is-active' : ''}`}
      style={{ left, top, width, height }}
      onPointerEnter={() => onHover(brickKey)}
      onPointerLeave={() => onHover(null)}
    >
      <span className="world-launcher__image" style={cover} aria-hidden="true" />
      {playing && world.coverVideo && (
        <video
          className={`world-launcher__video${ready ? ' is-ready' : ''}`}
          src={world.coverVideo}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          aria-hidden="true"
          onLoadedData={() => setReady(true)}
        />
      )}
      {/* The slab's thick edge: the same picture, magnified, seen only in a band. */}
      <span className="world-launcher__rim" aria-hidden="true"><span style={cover} /></span>
      <span className="world-launcher__fringe" aria-hidden="true" />
      <span className="world-launcher__sheen" aria-hidden="true" />
      <button
        type="button"
        className="world-launcher__hit"
        aria-expanded={open}
        aria-label={title}
        onClick={() => onToggle(brickKey)}
        onFocus={() => onHover(brickKey)}
      />
      <span className="world-launcher__meta" aria-hidden="true">
        <span><i>{String(index + 1).padStart(2, '0')}</i>{editionLabel(world.locale)}</span>
        <span>{current ? t('Current game') : t('{count} saves', { count: world.saves.length })}</span>
      </span>
      <div className="world-launcher__caption">
        <b>{title}</b>
        {world.description && <small>{world.description}</small>}
        {open && (
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
});

/**
 * The world launcher (docs/ui/世界Launcher.md): an endless wall of thick glass
 * bricks, one world per brick, repeating in every direction. Scroll, drag or use
 * the arrow keys to wander; the wall leans with the pointer. Every session starts
 * here and every world returns here.
 */
export function WorldLauncher({ shelf, loading, onLoad, onClose, onManageSaves, focus }: {
  shelf: WorldShelf;
  loading: string | null;
  onLoad: (path: string) => void;
  /** Present while a world is open: go back into it. */
  onClose?: () => void;
  onManageSaves: () => void;
  focus?: FocusCoordinator;
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
  // Where wheel and keys are easing the wall to; null while dragging or at rest.
  const target = useRef<{ x: number; y: number } | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; t: number; vx: number; vy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const boost = useRef({ at: 0, factor: 1 });
  const frames = useRef({ tilt: 0, glide: 0, ease: 0 });
  const loadRef = useRef(onLoad);
  loadRef.current = onLoad;
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  const openedRef = useRef<string | null>(null);
  openedRef.current = opened;
  const leaseRef = useRef<FocusSurfaceLease | null>(null);
  const requestClose = useCallback(() => {
    // Collapsing an opened brick keeps the launcher open, so it must not mark
    // the lease closing: a lease left "closing" refuses every later close.
    if (openedRef.current) { setOpened(null); return; }
    if (!closeHandler.current) return;
    const lease = leaseRef.current;
    if (lease && !lease.markClosing()) return;
    closeHandler.current();
  }, []);
  const active = opened ?? hovered;
  useEffect(() => {
    if (!focus) return;
    let opener: HTMLElement | null = null;
    let restored = false;
    const returnFocus = {
      capture: () => {
        if (opener) return;
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && activeElement !== document.body) opener = activeElement;
      },
      restore: () => {
        if (restored) return false;
        restored = true;
        if (opener && document.contains(opener)) {
          opener.focus();
          return true;
        }
        return false;
      },
    };
    const lease = focus.registerSurface({
      key: 'world-launcher',
      owner: 'workspace',
      priority: 400,
      root: root.current,
      close: requestClose,
      returnFocus,
    });
    leaseRef.current = lease;
    return () => {
      if (leaseRef.current === lease) leaseRef.current = null;
      lease.unregister();
      window.requestAnimationFrame(() => returnFocus.restore());
    };
  }, [focus, requestClose]);

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

  /** Direct movement (drag, glide). */
  const panBy = useCallback((dx: number, dy: number) => {
    if (!pan.current) return;
    pan.current.x += dx;
    pan.current.y += dy;
    place();
  }, [place]);

  const stopMotion = useCallback(() => {
    cancelAnimationFrame(frames.current.glide);
    cancelAnimationFrame(frames.current.ease);
    frames.current.ease = 0;
    target.current = null;
  }, []);

  /** Wheel and keys: ease towards a target; quick successive ticks accelerate. */
  const scrollBy = useCallback((dx: number, dy: number) => {
    const at = pan.current;
    if (!at) return;
    const now = performance.now();
    const speed = boost.current;
    speed.factor = now - speed.at < 140 ? Math.min(MAX_WHEEL_BOOST, speed.factor * 1.06) : 1;
    speed.at = now;
    const from = target.current ?? { x: at.x, y: at.y };
    target.current = { x: from.x + dx * speed.factor, y: from.y + dy * speed.factor };
    if (still) {
      at.x = target.current.x;
      at.y = target.current.y;
      target.current = null;
      place();
      return;
    }
    if (frames.current.ease) return;
    let last = now;
    const step = (time: number) => {
      const goal = target.current;
      const p = pan.current;
      if (!goal || !p) { frames.current.ease = 0; return; }
      const share = 1 - Math.pow(1 - EASE_PER_FRAME, Math.min(64, time - last) / 16.7);
      last = time;
      p.x += (goal.x - p.x) * share;
      p.y += (goal.y - p.y) * share;
      if (Math.abs(goal.x - p.x) + Math.abs(goal.y - p.y) < 0.5) {
        p.x = goal.x;
        p.y = goal.y;
        target.current = null;
        frames.current.ease = 0;
        place();
        return;
      }
      place();
      frames.current.ease = requestAnimationFrame(step);
    };
    frames.current.ease = requestAnimationFrame(step);
  }, [place, still]);

  useEffect(() => () => { cancelAnimationFrame(frames.current.tilt); stopMotion(); }, [stopMotion]);

  // Wheel and trackpad: both axes at once, so the wall scrolls in any direction.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cancelAnimationFrame(frames.current.glide);
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      scrollBy(event.deltaX * unit, event.deltaY * unit);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [scrollBy]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = { ArrowLeft: [-cellW * 0.6, 0], ArrowRight: [cellW * 0.6, 0], ArrowUp: [0, -cellH * 0.6], ArrowDown: [0, cellH * 0.6] }[event.key];
      if (!step || (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) return;
      event.preventDefault();
      scrollBy(step[0], step[1]);
      // Arrow navigation is local launcher behavior; Escape belongs only to
      // App's document-capture transaction.
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [cellW, cellH, scrollBy]);

  // Lean is written to a CSS variable pair read only by the wall's transform:
  // the bricks themselves never repaint when the pointer moves.
  const lean = (x: number, y: number) => {
    cancelAnimationFrame(frames.current.tilt);
    frames.current.tilt = requestAnimationFrame(() => {
      root.current?.style.setProperty('--tilt-x', x.toFixed(3));
      root.current?.style.setProperty('--tilt-y', y.toFixed(3));
    });
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    stopMotion();
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
      if (Math.hypot(vx, vy) > 0.02) frames.current.glide = requestAnimationFrame(step);
    };
    frames.current.glide = requestAnimationFrame(step);
  };

  const onHover = useCallback((key: string | null) => {
    if (!drag.current?.moved) setHovered(key);
  }, []);
  const onToggle = useCallback((key: string) => setOpened(value => (value === key ? null : key)), []);
  const load = useCallback((path: string) => loadRef.current(path), []);

  const bricks = useMemo(
    () => visibleBricks(anchor.x, anchor.y, size.w + cellW, size.h + cellH, geometry, 1),
    [anchor, size, geometry, cellW, cellH],
  );
  // Videos play only near the centre of the view: decoding one per brick would stall the wall.
  const playing = useMemo(() => {
    if (still) return new Set<string>();
    const centreX = anchor.x + cellW / 2 + size.w / 2;
    const centreY = anchor.y + cellH / 2 + size.h / 2;
    const ranked = bricks
      .map(brick => ({ key: `${brick.col}:${brick.row}`, distance: Math.hypot(brick.left + geometry.w / 2 - centreX, brick.top + geometry.h / 2 - centreY) }))
      .sort((a, b) => a.distance - b.distance);
    return new Set(ranked.slice(0, PLAYING_BRICKS).map(entry => entry.key));
  }, [anchor, bricks, cellW, cellH, geometry, size, still]);

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
        {worlds.map(world => <span key={world.id} style={{ backgroundImage: `url("${withBase(world.cover)}")` }} />)}
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
          {onClose && <button type="button" className="world-launcher__pill" onClick={requestClose}>{t('Continue this story')}</button>}
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
              const key = `${brick.col}:${brick.row}`;
              return (
                <Brick
                  key={key}
                  brickKey={key}
                  world={worlds[index]}
                  index={index}
                  left={brick.left}
                  top={brick.top}
                  width={geometry.w}
                  height={geometry.h}
                  active={active === key}
                  open={opened === key}
                  playing={!still && (playing.has(key) || active === key)}
                  loading={loading}
                  t={t}
                  onHover={onHover}
                  onToggle={onToggle}
                  onLoad={load}
                />
              );
            })}
          </div>
        </div>
      </div>
      <p className="world-launcher__hint" aria-hidden="true">{t('Drag or scroll to wander')}</p>
      {LAUNCHER_CREDIT && <p className="world-launcher__credit">{LAUNCHER_CREDIT}</p>}
    </div>
  );
}
