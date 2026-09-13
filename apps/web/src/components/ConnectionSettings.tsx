import { useEffect, useState } from 'react';

const services = [
  ['DashScope TTS', 'DASHSCOPE_API_KEY', 'AIRP_TTS_BASE_URL'],
  ['OpenAI-compatible', 'OPENAI_API_KEY', 'OPENAI_BASE_URL'],
  ['Flow media proxy', 'FLOW_API_KEY', 'FLOW_API_BASE'],
  ['DeepSeek V4.1 Flash', 'DEEPSEEK_API_KEY', null],
] as const;

export function ConnectionSettings({ onSaved }: { onSaved: () => void }) {
  const [config, setConfig] = useState<Record<string, string | boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const refresh = async () => {
    const res = await fetch('/api/connection-settings', { cache: 'no-store' });
    if (!res.ok) throw new Error('Open this page on localhost to configure server credentials.');
    setConfig(await res.json()); setAvailable(true);
  };
  useEffect(() => { void refresh().catch(error => setStatus(error.message)); }, []);
  const save = async () => {
    setSaving(true); setStatus('');
    try {
      const res = await fetch('/api/connection-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AIRP-Settings': '1' }, body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error('Could not save. Check the service URLs and server permissions.');
      setDraft({}); await refresh(); onSaved();
      setStatus('Saved on the server. TTS applies immediately. Restart existing agents before using new agent credentials.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save settings.'); }
    finally { setSaving(false); }
  };
  return <section style={{ marginTop: 24 }}>
    <h3>Server connections</h3>
    <p>Keys stay on the server in .local.env (or .env.local). Blank fields keep existing values. Flow configures the media proxy, not the writer model.</p>
    <p>DeepSeek V4.1 Flash uses https://api.deepseek.com with model deepseek-flash. After saving, restart existing agents and select deepseek / deepseek-flash in Agents → Model.</p>
    {available && services.map(([label, key, url]) => <fieldset key={key} disabled={saving} style={{ margin: '16px 0', display: 'grid', gap: 8 }}>
      <legend>{label}</legend>
      {url && <label>Service URL<input aria-label={`${label} URL`} type="url" value={draft[url] ?? String(config[url] ?? '')} onChange={e => setDraft(d => ({ ...d, [url]: e.target.value }))} /></label>}
      <label>API key · {config[key] ? 'Configured' : 'Not configured'}<input aria-label={`${label} API key`} type="password" autoComplete="new-password" spellCheck={false} value={draft[key] ?? ''} placeholder="Leave blank to keep current key" onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} /></label>
    </fieldset>)}
    {available && <button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save connections'}</button>}
    <p role="status">{status}</p>
  </section>;
}
