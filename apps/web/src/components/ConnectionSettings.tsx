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

/** One row of the connection self-test (docs/settings/连接测试.md). */
interface ConnectionCheck {
  id: string;
  label: string;
  status: 'ok' | 'failed' | 'skipped';
  ms: number;
  detail: string;
}

export function ConnectionSettings({ onSaved }: { onSaved: () => void }) {
  const { t } = useLocale();
  const [config, setConfig] = useState<Record<string, string | boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [statusKey, setStatusKey] = useState<StatusKey | null>(null);
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checks, setChecks] = useState<ConnectionCheck[] | null>(null);
  const [testError, setTestError] = useState(false);
  const runTests = async () => {
    setTesting(true);
    setTestError(false);
    try {
      const res = await fetch('/api/connection-settings/test', { method: 'POST', headers: { 'X-AIRP-Settings': '1' } });
      if (!res.ok) throw new Error('test-failed');
      setChecks((await res.json()).checks);
    } catch {
      setTestError(true);
    } finally {
      setTesting(false);
    }
  };
  const statusLabel = (status: ConnectionCheck['status']) => status === 'ok' ? t('OK') : status === 'failed' ? t('Failed') : t('Skipped');
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
  // Brand names stay as-is; the two descriptive service names are localized.
  const serviceName = (label: string) => label === 'OpenAI-compatible' ? t('OpenAI-compatible') : label === 'Flow media proxy' ? t('Flow media proxy') : label;
  return <section style={{ marginTop: 24 }}>
    <h3>{t('Server connections')}</h3>
    <p>{t('Keys stay on this server in .local.env when it exists, otherwise in .env.local. Blank key fields keep their current values. Flow configures media generation, not the writer model.')}</p>
    <p>{t('DeepSeek V4.1 Flash uses https://api.deepseek.com with model deepseek-flash. Save, restart existing agents, then select deepseek / deepseek-flash in Agents → Model.')}</p>
    {available && services.map(([label, key, url]) => <fieldset key={key} disabled={saving} style={{ margin: '16px 0', display: 'grid', gap: 8 }}>
      <legend>{serviceName(label)}</legend>
      {url && <label>{t('Service URL')}<input aria-label={t('{service} service URL', { service: serviceName(label) })} type="url" value={draft[url] ?? String(config[url] ?? '')} onChange={e => setDraft(d => ({ ...d, [url]: e.target.value }))} style={{ display: 'block', width: '100%', color: '#272321', background: '#f5efdf', padding: 8 }} /></label>}
      <label>{t('API key')} · {config[key] ? t('Configured') : t('Not configured')}<input aria-label={t('{service} API key', { service: serviceName(label) })} type="password" autoComplete="new-password" spellCheck={false} value={draft[key] ?? ''} placeholder={t('Leave blank to keep the current key')} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} style={{ display: 'block', width: '100%', color: '#272321', background: '#f5efdf', padding: 8 }} /></label>
    </fieldset>)}
    {available && <button disabled={saving} onClick={() => void save()}>{saving ? t('Saving…') : t('Save connections')}</button>}
    {/* Was `{status}` — the global window.status — so save results never showed. */}
    <p role="status">{statusKey ? t(statusKey) : ''}</p>
    {available && <section style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 6px' }}>{t('Connection test')}</h4>
      <p style={{ margin: '0 0 8px' }}>{t('Sends one tiny request to every configured service: the writer and character models, TTS, voice input and GPT Live. Takes up to 25 seconds.')}</p>
      <button disabled={testing || saving} onClick={() => void runTests()}>{testing ? t('Testing…') : t('Test connections')}</button>
      {testError && <p role="alert">{t('The test could not run. Open this page on localhost and check that the server is up.')}</p>}
      {checks && <table style={{ marginTop: 10, width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {checks.map(check => <tr key={check.id} data-status={check.status} style={{ borderTop: '1px solid var(--ux-color-line)' }}>
            <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>{check.label}</td>
            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontWeight: 600, color: check.status === 'failed' ? 'var(--ux-color-rust)' : check.status === 'ok' ? 'var(--ux-color-sage)' : 'var(--ux-color-muted)' }}>
              {statusLabel(check.status)}{check.ms > 0 ? ` · ${(check.ms / 1000).toFixed(1)}s` : ''}
            </td>
            <td style={{ padding: '6px 0', overflowWrap: 'anywhere', color: 'var(--ux-color-muted)' }}>{check.detail}</td>
          </tr>)}
        </tbody>
      </table>}
    </section>}
  </section>;
}
