import { useEffect, useState } from 'react';
import type { GateFeedback } from '../../lib/gate-feedback.js';
import { useLocale } from '../../lib/i18n.js';
import './gate-threshold.css';

// Local presentation only: no writer call, world event, item move or dice roll.
export function GateThreshold() {
  const { locale } = useLocale();
  const [beat, setBeat] = useState<GateFeedback | null>(null);
  useEffect(() => {
    const onBeat = (e: Event) => setBeat((e as CustomEvent<GateFeedback | null>).detail);
    const clear = () => setBeat(null);
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') clear(); };
    window.addEventListener('airp:gate-feedback', onBeat);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('airp:gate-feedback', onBeat);
      window.removeEventListener('keydown', escape);
    };
  }, []);
  useEffect(() => {
    if (!beat) return;
    const paths = new Set([`${beat.target}/README.md`, ...beat.items.map(i => i.path)]);
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-path]')].filter(n => paths.has(n.dataset.path ?? ''));
    nodes.forEach(n => n.classList.add('threshold-cue'));
    return () => nodes.forEach(n => n.classList.remove('threshold-cue'));
  }, [beat]);
  if (!beat) return null;
  const ja = locale === 'ja';
  return <aside className="gate-threshold" aria-label={ja ? '場面のひとこと' : 'A moment in the scene'}>
    <div className="gate-threshold__ink" role="status" aria-live="polite">
      {beat.title && <div className="gate-threshold__place">{beat.title}</div>}
      <p>{beat.text || (ja ? 'まだ、ここから先へは進めない。手元の手がかりを確かめよう。' : 'Not yet. There is still something to attend to before going on.')}</p>
      {beat.items.length > 0 && <p className="gate-threshold__items">{ja ? '目を向ける → ' : 'Look toward → '}{beat.items.map(i => i.title).join(' · ')}</p>}
    </div>
    <button type="button" onClick={() => setBeat(null)}>{ja ? 'この場に戻る' : 'Return to the scene'} <span aria-hidden="true">↩</span></button>
  </aside>;
}
