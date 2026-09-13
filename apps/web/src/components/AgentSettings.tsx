import { useEffect, useState } from 'react';
import type { AutoWrite, WorldSettings } from '@airp/shared/world-settings';
type Model = { provider: string; id: string; name?: string };
type Status = { world: string; active: string[]; models: Model[]; writer: { model: Model | null; thinking: string }; characters: { id: string; model: Model | null; thinking: string }[]; preferences: Partial<Record<'writer' | 'character', { provider: string; model: string; thinking: string }>>; busy: boolean; progress: Record<string, { stage: string; startedAt: number; updatedAt: number }> };
export function AgentSettings({ settings, onSaveSettings }: {
  settings: WorldSettings;
  onSaveSettings: (next: WorldSettings) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
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
          if (data.progress?.writer) window.dispatchEvent(new CustomEvent('airp:agent-frame', { detail: { type: 'agent_progress', source: 'writer', ...data.progress.writer, busy: data.active.includes('writer') || data.queued > 0 } }));
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
    setModel(current ? `${current.provider}/${current.model}` : actual?.model ? `${actual.model.provider}/${actual.model.id}` : '');
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
  const activeAgent = status?.active[0] ?? 'writer';
  const progress = status?.progress[activeAgent];
  const seconds = progress ? Math.max(0, Math.floor((Date.now() - progress.startedAt) / 1000)) : 0;
  return <div className="agent-settings">
    <button onClick={() => setOpen(!open)} aria-expanded={open}>Agents · {!status ? 'Connecting' : status.busy ? `${seconds}s` : 'Ready'}</button>
    {open && <section className="agent-settings-panel" aria-label="Agent models and progress">
      <div><strong>Agents</strong><button onClick={() => setOpen(false)} aria-label="Close agent settings">×</button></div>
      <p role="status">{!status ? 'Connecting to the engine' : status.busy ? progress?.stage ?? 'Preparing the response' : 'Ready for your next action'}</p>
      <p>Writer: {status?.writer.model?.id ?? 'Unknown'} · {status?.writer.thinking ?? '—'}<br />{status?.characters.map(c => <span key={c.id}>{c.id}: {c.model?.id ?? 'Unknown'} · {c.thinking}<br /></span>)}</p>
      {status?.busy && <p>{seconds}s elapsed · You can browse while waiting. {progress && Date.now() - progress.updatedAt > 15000 ? 'No recent progress. You can stop the turn.' : ''}</p>}
      <label>Auto-write<select value={settings.autoWrite} onChange={e => void onSaveSettings({ autoWrite: e.target.value as AutoWrite })}><option value="off">Off · the writer waits for you</option><option value="scenes">Scenes · write unwritten scenes on entry</option><option value="scenes-and-choices">Scenes + choices · also advance on each choice</option></select></label>
      <label>Agent<select value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="writer">Writer</option><option value="character">Characters</option></select></label>
      <label>Model<select value={model} onChange={e => setModel(e.target.value)}><option value="">Choose a model</option>{status?.models.map(m => <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>{m.provider} / {m.name || m.id}</option>)}</select></label>
      <label>Reasoning<select value={thinking} onChange={e => setThinking(e.target.value)}><option value="off">Off · fastest</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <p>Saved for this world save. Character memory is kept. Model availability does not guarantee account access.</p>
      <button disabled={saving || !status || status.busy || !model} onClick={() => void save()}>{saving ? 'Applying…' : 'Apply model'}</button>
      {status?.busy && <p>Wait for the current turn before changing models.</p>}
      {error && <p role="alert">{error}</p>}
    </section>}
  </div>;
}
