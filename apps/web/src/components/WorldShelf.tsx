import React, { useEffect, useRef, useState } from 'react';
import { airpGateway, type WorldShelf as Shelf } from '../lib/airp-gateway.js';
import { useLocale } from '../lib/i18n.js';

export function WorldShelf({ shelf, loading, onLoad, onClose, onRefresh }: {
  shelf: Shelf; loading: string | null; onLoad: (path: string) => void;
  onClose: () => void; onRefresh: () => Promise<void>;
}) {
  const { t, locale } = useLocale();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!busy && !panel.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); if (!busy) onClose(); } };
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', key, true); };
  }, [busy, onClose]);
  const group = shelf.groups?.find(g => g.id === selected);
  const remove = async (savePath: string) => {
    setBusy(true); setMessage('');
    try {
      await airpGateway.deleteSave(savePath);
      setConfirm(null);
      setMessage(t('Save moved to trash.'));
      await onRefresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <section ref={panel} className="prototype-world-picker world-directory" role="dialog" aria-modal="false" aria-label={t(group ? 'Saved games' : 'Choose a world')}>
      <header className="world-directory__header"><span>{t('WORLD SHELF')}</span><button autoFocus disabled={busy} onClick={onClose} aria-label={t('Close')}>×</button></header>
      <h2>{group?.name || t('Choose a world')}</h2>
      {!group ? (shelf.groups || []).map((entry, index) => <button className="world-directory__entry" key={entry.id} onClick={() => { setSelected(entry.id); setMessage(''); }}>
        <small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small><div><b>{entry.name}</b><span>{t('{count} saves', { count: entry.saves.length })}</span></div><span aria-hidden="true">↗</span>
      </button>) : <>
        <button disabled={busy || loading !== null} onClick={() => { setSelected(null); setConfirm(null); setMessage(''); }}>{t('← All worlds')}</button>
        {group.templatePath && <button disabled={busy || loading !== null} onClick={() => onLoad(group.templatePath!)}>{t('＋ Start a new game')}</button>}
        <h3>{t('Saved games')}</h3>
        {!group.saves.length && <p>{t('No saves yet. Start a new game above.')}</p>}
        {group.saves.map(save => <article className="world-save-row" key={save.path}>
          <button className="world-save-open" disabled={busy || loading !== null || confirm !== null} onClick={() => onLoad(save.path)}>
            <b>{t('Save ID')}: {save.id}</b>
            <span>{new Date(save.updatedAt).toLocaleString(locale)}{save.active ? ` · ${t('Current game')}` : ''}{loading === save.path ? t(' · opening…') : ''}</span>
          </button>
          <button disabled={busy || loading !== null || save.active} aria-label={`${t('Delete save')}: ${save.id}`} title={save.active ? t('Open another save before deleting this one.') : undefined} onClick={() => { setConfirm(save.path); setMessage(''); }}>{t('Delete save')}</button>
          {confirm === save.path && <div className="world-save-confirm">
            <p>{t('Move this save to trash? Its files will be kept for recovery.')}</p>
            <button disabled={busy} onClick={() => void remove(save.path)}>{t('Move to trash')}</button>
            <button disabled={busy} onClick={() => setConfirm(null)}>{t('Cancel')}</button>
          </div>}
        </article>)}
      </>}
      {message && <p role="status">{message}</p>}
      <button className="prototype-close" disabled={busy} onClick={onClose}>{t('Continue this story')}</button>
    </section>;
}
