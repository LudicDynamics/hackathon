import { useEffect, useRef, useState } from 'react';
import { MarkdownText } from '../lib/md.js';
import { useLocale } from '../lib/i18n.js';
import { renderFrontmatterWidgets } from '../lib/fm.js';
import { airpGateway } from '../lib/airp-gateway.js';
import { playFoley } from '../lib/audio.js';
import { ItemArtwork } from './ItemArtwork.js';

export function BagItemDialog({ item, onClose, onPlace, onUse, useDisabled = false, inline = false }: {
  item: { path: string; filename: string; body: string; frontmatter: Record<string, any> | null };
  onClose: () => void; onPlace?: (path: string) => Promise<boolean>;
  onUse?: (path: string) => void;
  useDisabled?: boolean;
  inline?: boolean;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const paper = useRef<HTMLElement>(null);
  useEffect(() => { playFoley('page-turn'); }, [item.path]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', key, true);
    const outside = (e: PointerEvent) => { if (!paper.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener('pointerdown', outside, true);
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', outside, true); };
  }, [onClose]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const image = item.frontmatter?.image || item.frontmatter?.cover;
  return <section ref={paper} data-reading data-no-drag className={`paper-reading${inline ? ' paper-reading--inline' : ' paper-reading--carried'}`} role="region" aria-label={String(item.frontmatter?.title || item.filename)} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <header>
        <h2><button onClick={onClose} title={t('Close')}>{item.frontmatter?.title || item.filename}</button></h2>
        <button autoFocus className="paper-reading__fold" aria-label={t('Close')} onClick={onClose}>↙</button>
      </header>
      <div className="paper-reading__content">
      {!inline && <div className="carried-item-artwork"><ItemArtwork item={item} /></div>}
      {inline && typeof image === 'string' && <img src={airpGateway.assetUrl(image)} alt="" style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain' }} />}
      <MarkdownText text={item.body} />
      <fieldset disabled={busy}>
        {renderFrontmatterWidgets(item.frontmatter, { filePath: item.path, reveal: true, onChoice: choice => void run(() => airpGateway.choose(item.path, choice)) })}
      </fieldset>
      </div>
      <fieldset disabled={busy}>
        {onPlace && <button type="button" onClick={() => void run(async () => { if (await onPlace(item.path)) onClose(); else setError(t('Could not move item')); })}>{t('Place in current scene')}</button>}
        {onUse && <button type="button" disabled={useDisabled} onClick={() => onUse(item.path)}>{t('Use this item')}</button>}
      </fieldset>
      {error && <p role="alert">{error}</p>}
  </section>;
}
