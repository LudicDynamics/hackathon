import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConnectionSettings } from './ConnectionSettings.js';
import { readTtsConfig, setTtsEnabled, ttsEnabled, type TtsConfig } from '../lib/tts-readiness.js';

export function TtsSettings() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const [enabled, setEnabled] = useState(ttsEnabled);
  const [config, setConfig] = useState<TtsConfig | null>(null);
  const [error, setError] = useState('');
  const refresh = async () => {
    try { setConfig(await readTtsConfig(true)); setError(''); }
    catch { setError('Voice service is unavailable. Text dialogue still works.'); }
  };
  useEffect(() => {
    const warn = () => setNotice(true);
    window.addEventListener('airp:tts-unavailable', warn);
    return () => window.removeEventListener('airp:tts-unavailable', warn);
  }, []);
  return <>
    <button type="button" onClick={() => { setOpen(true); void refresh(); }}>Voice & connections</button>
    {notice && !open && createPortal(<aside className="tts-notice" role="status">
      Voice is unavailable. Check TTS configuration; text dialogue still works.
      <button onClick={() => { setOpen(true); setNotice(false); void refresh(); }}>Settings</button>
      <button aria-label="Dismiss voice notice" onClick={() => setNotice(false)}>×</button>
    </aside>, document.body)}
    {open && createPortal(<div className="prototype-dialog-backdrop" onClick={() => setOpen(false)}>
      <section className="prototype-world-picker" role="dialog" aria-modal="true" aria-label="Voice settings" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}>
        <button onClick={() => setOpen(false)} aria-label="Close voice settings" autoFocus>Close</button>
        <h2>Character voice</h2>
        <label><input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); setTtsEnabled(e.target.checked); }} /> Enable character voice on this browser</label>
        <p role="status">{error || (config ? config.configured ? 'Configured · availability is checked when speaking' : 'TTS is not configured. Text dialogue remains available.' : 'Checking configuration…')}</p>
        {config && <><p>Model: {config.model}</p><p>Default voice: {config.defaultVoice} (characters may override it)</p></>}
        {config && !config.configured && <p>Add your DashScope API key below. Text dialogue remains available.</p>}
        <button onClick={() => { void refresh(); }}>Recheck configuration</button>
        <ConnectionSettings onSaved={() => { void refresh(); }} />
      </section>
    </div>, document.body)}
  </>;
}
