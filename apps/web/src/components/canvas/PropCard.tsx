import { useState } from 'react';
import { airpGateway } from '../../lib/airp-gateway.js';
import { BagItemDialog } from '../BagItemDialog.js';
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
  if (open) return <BagItemDialog inline item={{ path: title, filename: title, body, frontmatter: { title } }} onClose={() => setOpen(false)} />;
  return <>
    <button className={`cabin-prop cabin-prop--${visual}`} aria-label={title}
      onClick={() => { if (onEnter) onEnter(); else setOpen(value => !value); }}>
      {image ? <img src={airpGateway.assetUrl(image)} alt="" /> : <span className="cabin-prop__shape" aria-hidden="true"><i /><b /></span>}
      <span className="cabin-prop__label">{title}</span>
      <span className="cabin-prop__hint">{onEnter ? 'TURN THE HANDLE' : 'INSPECT'}</span>
    </button>
  </>;
}
