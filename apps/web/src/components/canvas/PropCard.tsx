import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { airpGateway } from '../../lib/airp-gateway.js';
import { MarkdownText } from '../../lib/md.js';
import { playFoley } from '../../lib/audio.js';
import './prop-card.css';

interface Props {
  visual: 'envelope' | 'phone' | 'door';
  title: string;
  body: string;
  image?: string;
  onEnter?: () => void;
}

/** Prop shape is a presentation of its Markdown; inspecting never selects a choice. */
export function PropCard({ visual, title, body, image, onEnter }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [open]);
  return <>
    <button className={`cabin-prop cabin-prop--${visual}`} aria-label={title}
      onClick={() => { if (onEnter) onEnter(); else { playFoley('page-turn'); setOpen(value => !value); } }}>
      {image ? <img src={airpGateway.assetUrl(image)} alt="" /> : <span className="cabin-prop__shape" aria-hidden="true"><i /><b /></span>}
      <span className="cabin-prop__label">{title}</span>
      <span className="cabin-prop__hint">{onEnter ? 'TURN THE HANDLE' : 'INSPECT'}</span>
    </button>
    {open && createPortal(<div className="cabin-reading" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
        <button autoFocus onClick={() => setOpen(false)} aria-label="Close">×</button>
        <h2>{title}</h2><MarkdownText text={body} />
        <p className="cabin-reading__hint">Inspecting the object does not use it. Choose an action beside it to continue.</p>
      </section>
    </div>, document.body)}
  </>;
}
