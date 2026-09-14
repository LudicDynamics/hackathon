import { useEffect, useRef, useState } from 'react';
import { airpGateway } from '../../lib/airp-gateway.js';
import { BagItemDialog } from '../BagItemDialog.js';
import type { AppearanceView } from '../../lib/appearance-view.js';
import './prop-card.css';

interface Props {
  visual: 'envelope' | 'phone' | 'door';
  path?: string;
  filename?: string;
  title: string;
  body: string;
  frontmatter?: Record<string, any> | null;
  image?: string;
  onEnter?: () => void;
  /** The verified view from the `.object` shell (04 §:102): inspect reuses its tokens
   *  instead of resolving a second time. */
  appearance?: AppearanceView | null;
}

/** Prop shape is a presentation of its Markdown; inspecting never selects a choice. */
export function PropCard({ visual, path, filename, title, body, frontmatter, image, onEnter, appearance }: Props) {
  const [open, setOpen] = useState(false);
  const [inspected, setInspected] = useState(false);
  const clickTimer = useRef<number | null>(null);
  const enterGestureIssued = useRef(false);
  const isEnterableDoor = visual === 'door' && !!onEnter;

  useEffect(() => () => {
    clearTimeout(clickTimer.current ?? undefined);
    clickTimer.current = null;
  }, []);

  const handleClick = () => {
    if (!isEnterableDoor) {
      setOpen(value => !value);
      return;
    }
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current ?? undefined);
      clickTimer.current = null;
      setInspected(false);
      enterGestureIssued.current = true;
      onEnter?.();
      return;
    }
    // A door's first click is inspect only. The second click within the
    // inclusive 500ms gesture window is the sole enter intent.
    setInspected(true);
    clickTimer.current = window.setTimeout(() => { clickTimer.current = null; }, 500);
  };

  const handleDoubleClick = () => {
    if (enterGestureIssued.current) {
      enterGestureIssued.current = false;
      return;
    }
    clearTimeout(clickTimer.current ?? undefined);
    clickTimer.current = null;
    setInspected(false);
    onEnter?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isEnterableDoor || event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(clickTimer.current ?? undefined);
    clickTimer.current = null;
    setInspected(false);
    onEnter?.();
  };

  // The visual envelope/phone/door shape is FIXED (04 §渲染状态矩阵): appearance only
  // reaches the reading layer, never the drawn silhouette.
  if (open) return <BagItemDialog inline item={{ path: path ?? title, filename: filename ?? title, body, frontmatter: frontmatter ?? { title } }} onClose={() => setOpen(false)} appearance={appearance} />;
  return <>
    <button className={`cabin-prop cabin-prop--${visual}${inspected ? ' cabin-prop--inspected' : ''}`} aria-label={title}
      aria-expanded={isEnterableDoor ? inspected : undefined}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}>
      {image ? <img src={airpGateway.assetUrl(image, undefined, 'image')} alt="" /> : <span className="cabin-prop__shape" aria-hidden="true"><i /><b /></span>}
      <span className="cabin-prop__label">{title}</span>
      <span className="cabin-prop__hint">{isEnterableDoor ? 'DOUBLE-CLICK TO ENTER' : 'INSPECT'}</span>
    </button>
  </>;
}
