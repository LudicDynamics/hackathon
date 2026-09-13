import { useEffect, useRef, useState } from 'react';
import { MarkdownText } from '../lib/md.js';
import { useLocale } from '../lib/i18n.js';
import { renderFrontmatterWidgets } from '../lib/fm.js';
import { airpGateway } from '../lib/airp-gateway.js';
import { playFoley } from '../lib/audio.js';
import { ItemArtwork } from './ItemArtwork.js';
import { PhotoMedia } from './photo/PhotoMedia.js';
import {
  actionKey,
  ActionFeedbackStore,
  runAction,
  type ActionFeedback,
  type ActionResultLike,
} from '../lib/action-feedback.js';
import type { AppearanceView } from '../lib/appearance-view.js';

export function BagItemDialog({ item, onClose, onPlace, inline = false, appearance }: {
  item: { path: string; filename: string; body: string; frontmatter: Record<string, any> | null };
  onClose: () => void;
  onPlace?: (path: string) => Promise<boolean>;
  inline?: boolean;
  /** The verified view inherited from `.object` (04 §:86): the reading layer consumes the
   * same resolution and never re-resolves. Optional so an old/absent resolution keeps the
   * default paper-reading paint. */
  appearance?: AppearanceView | null;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const actionStore = useState(() => new ActionFeedbackStore())[0];
  const paper = useRef<HTMLElement>(null);
  useEffect(() => { playFoley('page-turn'); }, [item.path]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', key, true);
    const outside = (e: PointerEvent) => { if (!paper.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener('pointerdown', outside, true);
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', outside, true); };
  }, [onClose]);
  const choose = async (choice: string) => {
    setBusy(true); setError(''); setActionFeedback(null);
    // The gateway returns `{ok: true, ...details}`; the feedback seam retains
    // the actual details and distinguishes stale/refused choices from failures.
    const result = await runAction(
      actionStore,
      { key: actionKey('choice', `${item.path}:${choice}`), verb: 'choice', target: item.path },
      async () => await airpGateway.choose(item.path, choice) as ActionResultLike,
    );
    setActionFeedback(result);
    if (result.outcome === 'failed' || result.outcome === 'rejected') setError(result.message);
    setBusy(false);
  };
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const isPhoto = item.frontmatter?.component === 'photo';
  const image = typeof item.frontmatter?.image === 'string' ? item.frontmatter.image : item.frontmatter?.cover;
  // Carried photos use the same explicit missing/error states as canvas photos;
  // ordinary carried items retain ItemArtwork and inline legacy image behavior.
  return <section ref={paper} data-reading data-no-drag {...appearance?.attrs} style={appearance?.style} className={`paper-reading${inline ? ' paper-reading--inline' : ' paper-reading--carried'}`} role="region" aria-label={String(item.frontmatter?.title || item.filename)} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    <header>
      <h2><button onClick={onClose} title={t('Close')}>{item.frontmatter?.title || item.filename}</button></h2>
      <button autoFocus className="paper-reading__fold" aria-label={t('Close')} onClick={onClose}>↙</button>
    </header>
    <div className="paper-reading__content">
      {isPhoto ? (
        <>
          <PhotoMedia
            image={typeof item.frontmatter?.image === 'string' ? item.frontmatter.image : undefined}
            alt={String(item.frontmatter?.title || item.filename)}
            variant="carried"
          />
          {typeof item.frontmatter?.caption === 'string' && item.frontmatter.caption.trim() && (
            <p className="photo-detail__caption">{item.frontmatter.caption}</p>
          )}
        </>
      ) : (
        <>
          {!inline && <div className="carried-item-artwork"><ItemArtwork item={item} /></div>}
          {inline && typeof image === 'string' && <img src={airpGateway.assetUrl(image, undefined, 'image')} alt="" style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain' }} />}
        </>
      )}
      <MarkdownText text={item.body} />
      <fieldset disabled={busy} aria-busy={busy}>
        {renderFrontmatterWidgets(item.frontmatter, { filePath: item.path, reveal: true, onChoice: choose })}
        {onPlace && <button type="button" onClick={() => void run(async () => { if (await onPlace(item.path)) onClose(); else setError(t('Could not move item')); })}>{t('Place in current scene')}</button>}
      </fieldset>
      {busy && <small role="status">{t('Working…')}</small>}
      {actionFeedback && actionFeedback.outcome === 'conflict' && <p role="status" data-action-status="conflict">{actionFeedback.message}</p>}
      {actionFeedback && actionFeedback.outcome === 'accepted' && <p role="status" data-action-status="accepted">{actionFeedback.message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </section>;
}
