import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WorldShelf } from '../lib/airp-gateway.js';
import { useLocale } from '../lib/i18n.js';
import { useStill } from '../lib/motion.js';
import { launcherWorlds, worldTitle } from '../lib/world-launcher.js';
import './world-launcher.css';

/**
 * The world launcher (docs/ui/世界Launcher.md): every world a thick glass tile
 * on one wall that leans with the pointer. Every session starts here and every
 * world returns here.
 */
export function WorldLauncher({ shelf, loading, onLoad, onClose, onManageSaves }: {
  shelf: WorldShelf;
  loading: string | null;
  onLoad: (path: string) => void;
  /** Present while a world is open: go back into it. */
  onClose?: () => void;
  onManageSaves: () => void;
}) {
  const { t, locale } = useLocale();
  const still = useStill();
  const worlds = useMemo(() => launcherWorlds(shelf.groups ?? [], locale), [shelf.groups, locale]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const active = opened ?? hovered;
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (opened) setOpened(null);
      else if (onClose) onClose();
      else return;
      // The world's own Escape (layer back) must not fire underneath.
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, opened]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Tilt is written to CSS variables, not React state: the wall re-renders nothing.
  const lean = (x: number, y: number) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      root.current?.style.setProperty('--tilt-x', x.toFixed(3));
      root.current?.style.setProperty('--tilt-y', y.toFixed(3));
    });
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (still || event.pointerType === 'touch') return;
    lean((event.clientX / window.innerWidth - 0.5) * 2, (event.clientY / window.innerHeight - 0.5) * 2);
  };

  const split = Math.ceil(worlds.length / 2);
  const rows = [worlds.slice(0, split), worlds.slice(split)].filter(row => row.length > 0);

  return (
    <div
      ref={root}
      className="world-launcher"
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
        <nav aria-label={t('World launcher')}>
          <button type="button" className="world-launcher__pill" onClick={onManageSaves}>{t('Saved games')}</button>
          {onClose && <button type="button" className="world-launcher__pill" onClick={onClose}>{t('Continue this story')}</button>}
        </nav>
      </header>
      <div className="world-launcher__stage">
        <div className="world-launcher__wall" onPointerLeave={() => setHovered(null)}>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className={`world-launcher__row world-launcher__row--${rowIndex}`}>
              {row.map(world => {
                const index = worlds.indexOf(world);
                const title = worldTitle(world.name);
                const latest = world.saves[0];
                const isOpen = opened === world.id;
                const current = world.saves.some(save => save.active);
                const cover = { backgroundImage: `url("${world.cover}")` };
                return (
                  <article
                    key={world.id}
                    className={`world-launcher__tile${active === world.id ? ' is-active' : ''}`}
                    onPointerEnter={() => setHovered(world.id)}
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
                      onClick={() => setOpened(isOpen ? null : world.id)}
                      onFocus={() => setHovered(world.id)}
                    />
                    <span className="world-launcher__meta" aria-hidden="true">
                      <span><i>{String(index + 1).padStart(2, '0')}</i>{world.locale === 'ja' ? '日本語' : 'English'}</span>
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
          ))}
        </div>
      </div>
    </div>
  );
}
