import { useState } from 'react';
import { airpGateway } from '../../lib/airp-gateway.js';
import { BagItemDialog } from '../BagItemDialog.js';
import type { AppearanceView } from '../../lib/appearance-view.js';
import './prop-card.css';

interface Props {
  visual: 'envelope' | 'phone' | 'door';
  title: string;
  body: string;
  image?: string;
  onEnter?: () => void;
  /** The verified view from the `.object` shell (04 §:102): inspect reuses its tokens
   *  instead of resolving a second time. */
  appearance?: AppearanceView | null;
}

/** Prop shape is a presentation of its Markdown; inspecting never selects a choice. */
export function PropCard({ visual, title, body, image, onEnter, appearance }: Props) {
  const [open, setOpen] = useState(false);
  // The visual envelope/phone/door shape is FIXED (04 §渲染状态矩阵): appearance only
  // reaches the reading layer, never the drawn silhouette.
  if (open) return <BagItemDialog inline item={{ path: title, filename: title, body, frontmatter: { title } }} onClose={() => setOpen(false)} appearance={appearance} />;
  return <>
    <button className={`cabin-prop cabin-prop--${visual}`} aria-label={title}
      onClick={() => { if (onEnter) onEnter(); else setOpen(value => !value); }}>
      {image ? <img src={airpGateway.assetUrl(image)} alt="" /> : <span className="cabin-prop__shape" aria-hidden="true"><i /><b /></span>}
      <span className="cabin-prop__label">{title}</span>
      <span className="cabin-prop__hint">{onEnter ? 'TURN THE HANDLE' : 'INSPECT'}</span>
    </button>
  </>;
}
