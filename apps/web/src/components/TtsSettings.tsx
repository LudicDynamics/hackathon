import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConnectionSettings } from './ConnectionSettings.js';
import { NanamiTtsSettings } from './NanamiTtsSettings.js';
import { readTtsConfig, setTtsEnabled, ttsEnabled, type TtsConfig } from '../lib/tts-readiness.js';
import { setPlayHintsEnabled, usePlayHintsEnabled } from '../lib/play-hints.js';
import { useLocale } from '../lib/i18n.js';
import { getChannelVolume, setChannelVolume, type VolumeChannel } from '../lib/audio.js';
import { useAudio } from '../state/useAudio.js';

export function TtsSettings() {
  const { t } = useLocale();
  const { muted, toggleMuted } = useAudio();
  const hintsEnabled = usePlayHintsEnabled();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const [enabled, setEnabled] = useState(ttsEnabled);
  const [config, setConfig] = useState<TtsConfig | null>(null);
  const [hasError, setHasError] = useState(false);
  const [volumes, setVolumes] = useState(() => ({ music: getChannelVolume('music'), voice: getChannelVolume('voice') }));
  const changeVolume = (channel: VolumeChannel, value: number) => {
    setChannelVolume(channel, value);
    setVolumes(previous => ({ ...previous, [channel]: value }));
  };
  const refresh = async () => {
    try { setConfig(await readTtsConfig(true)); setHasError(false); }
    catch { setHasError(true); }
  };
  useEffect(() => {
    const warn = () => setNotice(true);
    window.addEventListener('airp:tts-unavailable', warn);
    return () => window.removeEventListener('airp:tts-unavailable', warn);
  }, []);
  return <>
    <button type="button" onClick={() => { setOpen(true); void refresh(); }}>{t('Sound & settings')}</button>
    {notice && !open && createPortal(<aside className="tts-notice" role="status">
      {t('Voice is unavailable. Check voice settings; text dialogue still works.')}
      <button onClick={() => { setOpen(true); setNotice(false); void refresh(); }}>{t('Sound & settings')}</button>
      <button aria-label={t('Dismiss voice notice')} onClick={() => setNotice(false)}>×</button>
    </aside>, document.body)}
    {open && createPortal(<div className="settings-backdrop" onClick={() => setOpen(false)}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-label={t('Sound & settings')} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}>
        <header className="settings-panel__header"><h1>{t('Sound & settings')}</h1><button onClick={() => setOpen(false)} aria-label={t('Close sound settings')} autoFocus>×</button></header>
        <h2>{t('Audio volume')}</h2>
        {muted && <div className="settings-master-muted" role="status">
          <span>{t('All sound is muted. Volume changes will apply after sound is turned on.')}</span>
          <button type="button" onClick={toggleMuted}>{t('Turn sound on')}</button>
        </div>}
        {(['voice', 'music'] as const).map(channel => <label className="settings-volume" key={channel}>
          <span>{channel === 'voice' ? t('Voice volume') : t('Background music')}<output>{Math.round(volumes[channel] * 100)}%</output></span>
          <input type="range" min="0" max="100" step="1" aria-label={channel === 'voice' ? t('Voice volume') : t('Background music')} value={Math.round(volumes[channel] * 100)} onChange={event => changeVolume(channel, Number(event.target.value) / 100)} />
        </label>)}
        <p>{t('Volumes are saved on this browser. Master mute still silences all audio.')}</p>
        <h2>{t('Play assistance')}</h2>
        <label><input type="checkbox" role="switch" checked={hintsEnabled} onChange={event => setPlayHintsEnabled(event.target.checked)} /> {t('Show Continue / next-step hints')}</label>
        <p>{t('Off hides the Continue button. Saved on this browser; your game progress is unchanged.')}</p>
        <h2>{t('Character voice')}</h2>
        <label><input type="checkbox" checked={enabled} onChange={event => { setEnabled(event.target.checked); setTtsEnabled(event.target.checked); }} /> {t('Enable character voice on this browser')}</label>
        <p role="status">{hasError
          ? t('Voice service is unavailable. Text dialogue still works.')
          : config
            ? t(config.configured ? 'Configured · availability is checked when speaking' : 'TTS is not configured. Text dialogue remains available.')
            : t('Checking configuration…')}</p>
        {config && <><p>{t('Online model')}: {config.model}</p><p>{t('Online fallback voice')}: {config.defaultVoice} · {t('Characters may override it')}</p></>}
        {config && !config.configured && <p>{t('Add a DashScope API key below, or configure Nanami local voice. Text dialogue remains available.')}</p>}
        <button onClick={() => { void refresh(); }}>{t('Recheck voice configuration')}</button>
        <NanamiTtsSettings onSaved={() => { void refresh(); }} />
        <ConnectionSettings onSaved={() => { void refresh(); }} />
      </section>
    </div>, document.body)}
  </>;
}
