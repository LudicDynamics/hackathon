import { useEffect, useState } from 'react';
import { MarkdownText } from '../lib/md.js';
import { useLocale } from '../lib/i18n.js';
import { renderFrontmatterWidgets } from '../lib/fm.js';
import { airpGateway } from '../lib/airp-gateway.js';
import { playFoley } from '../lib/audio.js';

export function BagItemDialog({ item, onClose, onPlace }: {
  item: { path: string; filename: string; body: string; frontmatter: Record<string, any> | null };
  onClose: () => void; onPlace?: (path: string) => Promise<boolean>;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { playFoley('page-turn'); }, [item.path]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const image = item.frontmatter?.image || item.frontmatter?.cover;
  return <div className="cabin-reading" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={String(item.frontmatter?.title || item.filename)} onClick={e => e.stopPropagation()}>
      <button autoFocus aria-label={t('Close')} onClick={onClose}>×</button>
      <h2>{item.frontmatter?.title || item.filename}</h2>
      {typeof image === 'string' && <img src={airpGateway.assetUrl(image)} alt="" style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain' }} />}
      <MarkdownText text={item.body} />
      <fieldset disabled={busy}>
        {renderFrontmatterWidgets(item.frontmatter, { filePath: item.path, reveal: true, onChoice: choice => void run(() => airpGateway.choose(item.path, choice)) })}
        {onPlace && <button type="button" onClick={() => void run(async () => { if (await onPlace(item.path)) onClose(); else setError(t('Could not move item')); })}>{t('Place in current scene')}</button>}
      </fieldset>
      <footer><button type="button" onClick={onClose}>{t('Close')}</button></footer>
      {error && <p role="alert">{error}</p>}
    </section>
  </div>;
}
