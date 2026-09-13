import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConnectionSettings } from './ConnectionSettings.js';
import { getChannelVolume, setChannelVolume, type VolumeChannel } from '../lib/audio.js';
import { useLocale } from '../lib/i18n.js';
import { readTtsConfig, setTtsEnabled, ttsEnabled, type TtsConfig } from '../lib/tts-readiness.js';

const clampPercent = (value: number): number => (
  Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, Math.round(value)))
);

const volumeToPercent = (value: number): number => (
  Number.isNaN(value) ? 100 : Math.round(Math.min(1, Math.max(0, value)) * 100)
);

function readVolume(channel: VolumeChannel): number {
  try {
    return volumeToPercent(getChannelVolume(channel));
  } catch {
    // A broken audio binding must not prevent text settings from opening.
    return 100;
  }
}

function readVolumes(): Record<VolumeChannel, number> {
  return { music: readVolume('music'), voice: readVolume('voice') };
}

export function TtsSettings() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const [enabled, setEnabled] = useState(ttsEnabled);
  const [config, setConfig] = useState<TtsConfig | null>(null);
  const [error, setError] = useState('');
  const [volumes, setVolumes] = useState<Record<VolumeChannel, number>>(readVolumes);
  const refresh = async () => {
    try { setConfig(await readTtsConfig(true)); setError(''); }
    catch { setError('Voice service is unavailable. Text dialogue still works.'); }
  };
  const openSettings = () => {
    setVolumes(readVolumes());
    setOpen(true);
    void refresh();
  };
  const onVolumeInput = (channel: VolumeChannel, rawValue: string) => {
    const percent = clampPercent(Number(rawValue));
    setVolumes(previous => ({ ...previous, [channel]: percent }));
    setChannelVolume(channel, percent / 100);
  };
  useEffect(() => {
    const warn = () => setNotice(true);
    window.addEventListener('airp:tts-unavailable', warn);
    return () => window.removeEventListener('airp:tts-unavailable', warn);
  }, []);
  return <>
    <button type="button" onClick={openSettings}>Voice & connections</button>
    {notice && !open && createPortal(<aside className="tts-notice" role="status">
      Voice is unavailable. Check TTS configuration; text dialogue still works.
      <button type="button" onClick={() => { setOpen(true); setNotice(false); setVolumes(readVolumes()); void refresh(); }}>Settings</button>
      <button type="button" aria-label="Dismiss voice notice" onClick={() => setNotice(false)}>×</button>
    </aside>, document.body)}
    {open && createPortal(<div className="prototype-dialog-backdrop" onClick={() => setOpen(false)}>
      <section className="prototype-world-picker settings-panel" role="dialog" aria-modal="true" aria-label="Voice settings" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close voice settings" autoFocus>Close</button>
        <h2>Character voice</h2>
        <fieldset aria-labelledby="audio-levels-heading">
          <legend id="audio-levels-heading">{t('Audio levels')}</legend>
          <div className="settings-volume">
            <span><label htmlFor="music-volume">{t('Music volume')}</label><output id="music-volume-value" htmlFor="music-volume">{t('{value}%', { value: volumes.music })}</output></span>
            <input id="music-volume" type="range" role="slider" min="0" max="100" step="1" value={volumes.music} aria-valuemin={0} aria-valuemax={100} aria-valuenow={volumes.music} aria-describedby="music-volume-value" onChange={e => onVolumeInput('music', e.currentTarget.value)} />
          </div>
          <div className="settings-volume">
            <span><label htmlFor="voice-volume">{t('Voice volume')}</label><output id="voice-volume-value" htmlFor="voice-volume">{t('{value}%', { value: volumes.voice })}</output></span>
            <input id="voice-volume" type="range" role="slider" min="0" max="100" step="1" value={volumes.voice} aria-valuemin={0} aria-valuemax={100} aria-valuenow={volumes.voice} aria-describedby="voice-volume-value" onChange={e => onVolumeInput('voice', e.currentTarget.value)} />
          </div>
        </fieldset>
        <label><input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); setTtsEnabled(e.target.checked); }} /> Enable character voice on this browser</label>
        {!enabled && <p role="status">{t('Voice playback is off; text dialogue remains available.')}</p>}
        <p role="status">{error || (config ? config.configured ? 'Configured · availability is checked when speaking' : t('TTS is not configured. Text dialogue remains available.') : 'Checking configuration…')}</p>
        {config && <><p>Model: {config.model}</p><p>Default voice: {config.defaultVoice} (characters may override it)</p></>}
        {config && !config.configured && <p>Add your DashScope API key below. Text dialogue remains available.</p>}
        <button type="button" onClick={() => { void refresh(); }}>Recheck configuration</button>
        <ConnectionSettings onSaved={() => { void refresh(); }} />
      </section>
    </div>, document.body)}
  </>;
}
