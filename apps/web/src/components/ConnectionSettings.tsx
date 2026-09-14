import { useEffect, useState } from 'react';
import { useLocale } from '../lib/i18n.js';

const services = [
  ['DashScope TTS', 'DASHSCOPE_API_KEY', 'AIRP_TTS_BASE_URL'],
  ['OpenAI-compatible', 'OPENAI_API_KEY', 'OPENAI_BASE_URL'],
  ['Flow media proxy', 'FLOW_API_KEY', 'FLOW_API_BASE'],
  ['DeepSeek V4.1 Flash', 'DEEPSEEK_API_KEY', null],
] as const;

type StatusKey =
  | 'Open this page on localhost to configure server connections.'
  | 'Could not save connections. Check the service URLs and server permissions.'
  | 'Connections saved. TTS applies immediately; restart existing agents before using new agent credentials.';

export function ConnectionSettings({ onSaved }: { onSaved: () => void }) {
  const { t } = useLocale();
  const [config, setConfig] = useState<Record<string, string | boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [statusKey, setStatusKey] = useState<StatusKey | null>(null);
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const refresh = async () => {
    const res = await fetch('/api/connection-settings', { cache: 'no-store' });
    if (!res.ok) throw new Error('local-only');
    setConfig(await res.json());
    setAvailable(true);
  };
  useEffect(() => {
    void refresh().catch(() => setStatusKey('Open this page on localhost to configure server connections.'));
  }, []);
  const save = async () => {
    setSaving(true);
    setStatusKey(null);
    try {
      const res = await fetch('/api/connection-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AIRP-Settings': '1' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error('save-failed');
      setDraft({});
      await refresh();
      onSaved();
      setStatusKey('Connections saved. TTS applies immediately; restart existing agents before using new agent credentials.');
    } catch {
      setStatusKey('Could not save connections. Check the service URLs and server permissions.');
    } finally {
      setSaving(false);
    }
  };
  return <section className="connection-settings">
    <h3>{t('Server connections')}</h3>
    <p>{t('Keys stay on this server in .local.env when it exists, otherwise in .env.local. Blank key fields keep their current values. Flow configures media generation, not the writer model.')}</p>
    <p>{t('DeepSeek V4.1 Flash uses https://api.deepseek.com with model deepseek-flash. Save, restart existing agents, then select deepseek / deepseek-flash in Agents → Model.')}</p>
    {available && services.map(([label, key, url]) => {
      const serviceName = label === 'OpenAI-compatible'
        ? t('OpenAI-compatible')
        : label === 'Flow media proxy' ? t('Flow media proxy') : label;
      return <fieldset key={key} disabled={saving}>
        <legend>{serviceName}</legend>
        {url && <label>{t('Service URL')}<input aria-label={t('{service} service URL', { service: serviceName })} type="url" value={draft[url] ?? String(config[url] ?? '')} onChange={event => setDraft(previous => ({ ...previous, [url]: event.target.value }))} /></label>}
        <label>{t('API key')} · {t(config[key] ? 'Configured' : 'Not configured')}<input aria-label={t('{service} API key', { service: serviceName })} type="password" autoComplete="new-password" spellCheck={false} value={draft[key] ?? ''} placeholder={t('Leave blank to keep the current key')} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.value }))} /></label>
      </fieldset>;
    })}
    {available && <button disabled={saving} onClick={() => void save()}>{t(saving ? 'Saving…' : 'Save connections')}</button>}
    <p role="status">{statusKey ? t(statusKey) : ''}</p>
  </section>;
}
