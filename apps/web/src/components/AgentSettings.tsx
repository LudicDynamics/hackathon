import { useEffect, useRef, useState } from 'react';
import type { FocusCoordinator, FocusSurfaceLease } from '../lib/focus-coordinator.js';
import type { AutoWrite, WorldSettings } from '@airp/shared/world-settings';
import { useWriterState } from '../lib/writer-state.js';
import { useLocale } from '../lib/i18n.js';
type Model = { provider: string; id: string; name?: string };
type Status = { world: string; active: string[]; models: Model[]; writer: { model: Model | null; thinking: string }; characters: { id: string; model: Model | null; thinking: string }[]; preferences: Partial<Record<'writer' | 'character', { provider: string; model: string; thinking: string }>> };
export function AgentSettings({ settings, onSaveSettings, focus }: {
  settings: WorldSettings;
  onSaveSettings: (next: WorldSettings) => Promise<void>;
  focus?: FocusCoordinator;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const leaseRef = useRef<FocusSurfaceLease | null>(null);
  const setOpenState = (next: boolean): void => setOpen(next);
  useEffect(() => {
    if (!open || !focus) return;
    let previous: HTMLElement | null = null;
    let restored = false;
    const lease = focus.registerSurface({
      key: 'agent-settings',
      owner: 'workspace',
      priority: 320,
      root: panelRef.current,
      close: () => setOpenState(false),
      returnFocus: {
        capture: () => {
          if (previous) return;
          const active = document.activeElement;
          if (active instanceof HTMLElement && active !== document.body) previous = active;
        },
        restore: () => {
          if (restored) return false;
          restored = true;
          if (previous && document.contains(previous)) {
            previous.focus();
            return true;
          }
          return false;
        },
      },
    });
    leaseRef.current = lease;
    return () => {
      if (leaseRef.current === lease) leaseRef.current = null;
      lease.unregister();
      window.requestAnimationFrame(() => {
        if (!restored && previous && document.contains(previous)) {
          restored = true;
          previous.focus();
        }
      });
    };
  }, [focus, open]);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<'writer' | 'character'>('writer');
  const [model, setModel] = useState('');
  const [thinking, setThinking] = useState('low');
  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/agent-settings${open ? '' : '?brief=true'}`); const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!cancelled) {
          setStatus(data);
        }
      } catch (e) { if (!cancelled) { setStatus(null); setError(String(e)); } }
      if (!cancelled) timer = setTimeout(poll, open ? 2000 : 5000);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open]);
  const current = status?.preferences[role];
  const actual = role === 'writer' ? status?.writer : status?.characters[0];
  useEffect(() => {
    setModel(current ? `${current.provider}/${current.model}` : actual?.model ? `${actual.model.provider}/${actual.model.id}` : 'deepseek/deepseek-v4-flash');
    setThinking(current?.thinking ?? actual?.thinking ?? 'low');
  }, [role, current?.model, current?.provider, current?.thinking, actual?.model?.id, actual?.model?.provider, actual?.thinking]);
  const save = async () => {
    const choice = status?.models.find(m => `${m.provider}/${m.id}` === model); if (!choice) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/agent-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, provider: choice.provider, model: choice.id, thinking, world: status?.world }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setStatus(data);
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  };
  const writer = useWriterState();
  const writing = writer.phase === 'writing';
  const seconds = writer.startedAt ? Math.max(0, Math.floor((Date.now() - writer.startedAt) / 1000)) : 0;
  const summary = !status
    ? t('Connecting')
    : writer.error
      ? t('Attention')
      : writing
        ? t('{seconds}s', { seconds })
    : t('Ready');
  return <div className="agent-settings" data-focus-owner={open ? 'workspace' : undefined}>
    <button onClick={() => setOpenState(!open)} aria-expanded={open}>{t('Agents · {summary}', { summary })}</button>
    {open && <section ref={panelRef} className="agent-settings-panel" aria-label={t('Agent models and progress')}>
      <p role="status">
        {!status ? t('Connecting to the engine') : writing ? writer.stage ?? t('Preparing the response') : t('Ready for your next action')}
        {writer.stopRequested ? t(' · Stop requested') : ''}
      </p>
      <p>{t('Writer')}: {status?.writer.model?.id ?? t('Unknown')} · {status?.writer.thinking ?? '—'}<br />{status?.characters.map(c => <span key={c.id}>{c.id}: {c.model?.id ?? t('Unknown')} · {c.thinking}<br /></span>)}</p>
      {writing && <p>{t('{seconds}s elapsed · You can browse while waiting.', { seconds })}</p>}
      {writer.error && <p role="alert">{writer.error.message}</p>}
      <label>{t('Auto-write')}<select value={settings.autoWrite} onChange={e => void onSaveSettings({ autoWrite: e.target.value as AutoWrite })}><option value="off">{t('Off · the writer waits for you')}</option><option value="scenes">{t('Scenes · write unwritten scenes on entry')}</option><option value="scenes-and-choices">{t('Scenes + choices · also advance on each choice')}</option></select></label>
      <label>{t('Agent')}<select value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="writer">{t('Writer')}</option><option value="character">{t('Characters')}</option></select></label>
      <label>{t('Model')}<select value={model} onChange={e => setModel(e.target.value)}><option value="">{t('Choose a model')}</option>{status?.models.map(m => <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>{m.provider} / {m.name || m.id}</option>)}</select></label>
      <label>{t('Reasoning')}<select value={thinking} onChange={e => setThinking(e.target.value)}><option value="off">{t('Off · fastest')}</option><option value="low">{t('Low')}</option><option value="medium">{t('Medium')}</option><option value="high">{t('High')}</option></select></label>
      <p>{t('Saved for this world save. Character memory is kept. Model availability does not guarantee account access.')}</p>
      <button disabled={saving || !status || writing || !model} onClick={() => void save()}>{saving ? t('Applying…') : t('Apply model')}</button>
      {writing && <p>{t('Wait for the current turn before changing models.')}</p>}
      {error && <p role="alert">{error}</p>}
    </section>}
  </div>;
}
