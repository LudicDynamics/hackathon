import { useLocale } from '../../lib/i18n.js';
import React from 'react';
import { renderFrontmatterWidgets } from '../../lib/fm.js';
import { airpGateway } from '../../lib/airp-gateway.js';

interface Props {
  item: { path: string; frontmatter: Record<string, any> | null };
  active?: boolean;
  onChoice?: (prompt: string) => void;
  onSelectChoice?: (path: string, choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (path: string) => void;
  onOpenCharacter?: (id: string) => void;
}

/** Shared by every Markdown form; visual form never decides interaction support. */
export function EntityInteractions({ item, active = false, onChoice, onSelectChoice, onDiceRolled, onEnterGate, onOpenCharacter }: Props) {
  const { t } = useLocale();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [feedback, setFeedback] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  const running = React.useRef(false);
  const [side, setSide] = React.useState('right');
  React.useLayoutEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const object = el.closest<HTMLElement>('.object');
    const viewport = object?.closest<HTMLElement>('[aria-label="Infinite canvas"]') || object?.parentElement?.parentElement;
    if (!object || !viewport) return;
    // Placement is locked for this hover session. Changing side changes the
    // panel's padding/height, so observing it and choosing again feeds back.
    let placement: string | null = null;
    const measure = () => {
      const box = object.getBoundingClientRect();
      const bounds = viewport.getBoundingClientRect();
      const scale = box.width / Math.max(object.offsetWidth, 1);
      const width = el.offsetWidth * scale;
      const height = Math.min(el.scrollHeight * scale, bounds.height - 32);
      const obstacles = Array.from(object.parentElement!.querySelectorAll<HTMLElement>('.object')).filter(node => node !== object).map(node => node.getBoundingClientRect());
      const overlap = (x: number, y: number, r: DOMRect) => Math.max(0, Math.min(x + width, r.right) - Math.max(x, r.left)) * Math.max(0, Math.min(y + height, r.bottom) - Math.max(y, r.top));
      const candidates = [
        { side: 'right', x: box.right, y: box.top },
        { side: 'left', x: box.left - width, y: box.top },
        { side: 'below', x: box.left, y: box.bottom },
      ];
      const score = (candidate: typeof candidates[number]) => {
        const outside = width * height - overlap(candidate.x, candidate.y, bounds);
        return outside * 10 + obstacles.reduce((sum, r) => sum + overlap(candidate.x, candidate.y, r), 0);
      };
      const best = candidates.find(candidate => candidate.side === placement)
        ?? candidates.reduce((best, next) => score(next) < score(best) ? next : best);
      placement = best.side;
      setSide(best.side);
      // Keep the bottom player/hand/action chrome out of the reading area.
      el.style.maxHeight = `${Math.max(80, (bounds.bottom - Math.max(bounds.top, best.y) - 110) / scale)}px`;
    };
    measure();
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport);
    viewport.addEventListener('wheel', schedule, { passive: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); viewport.removeEventListener('wheel', schedule); };
  }, [active]);
  const run = async (work: () => void | Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError(''); setFeedback('');
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { running.current = false; setBusy(false); }
  };
  const send = (action: string) => onChoice?.(`Regarding world file ${JSON.stringify(item.path)}, the player requests: ${action}`);
  const actions = Array.isArray(item.frontmatter?.actions)
    ? item.frontmatter.actions.filter((action: unknown): action is string => typeof action === 'string' && !!action.trim())
    : [];
  const fm = item.frontmatter;
  const isGate = fm?.type === 'gate' || item.path.endsWith('/README.md');
  const isPerson = fm?.type === 'character' || fm?.type === 'sprite';
  const collectable = !isGate && !isPerson && fm?.type !== 'chalk' && item.path.startsWith('world/') && fm?.portable !== false;
  const choose = (choice: string) => onSelectChoice?.(item.path, choice);
  const characterId = fm?.characterId || fm?.id || item.path.split('/').pop()!.replace(/\.md$/, '');
  return <div ref={ref} className={`entity-interactions entity-interactions--${side}`} data-no-drag onClick={event => event.stopPropagation()}>
    <fieldset disabled={busy}>
    {renderFrontmatterWidgets(item.frontmatter, { filePath: item.path, reveal: active, onChoice: choose, onDiceRolled })}
    <div className="entity-action-arrows" aria-label={t("Entity actions")}>
      {actions.map((action: string, index: number) => <button type="button" key={`${index}-${action}`} disabled={!onChoice} onClick={() => send(action)}><span aria-hidden="true">→ </span>{action}</button>)}
      {collectable && <button type="button" onClick={() => void run(async () => { await airpGateway.move(item.path, `player/${item.path.split('/').pop()}`); setFeedback(t('Added to belongings.')); })}>{t("→ Take along")}</button>}
      {isGate && onEnterGate && <button type="button" onClick={() => onEnterGate(typeof fm?.target === 'string' ? fm.target : item.path.replace(/\/README\.md$/, ''))}>{t("→ Enter scene")}</button>}
      {isPerson && onOpenCharacter && <button type="button" onClick={() => onOpenCharacter(fm?.characterId || fm?.id || item.path.split('/').pop()!.replace(/\.md$/, ''))}>{t("→ Talk")}</button>}
      {isPerson && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('airp:open-nook', { detail: { characterId } }))}>→ {t('Visit private space')}</button>}
      {onChoice && <button type="button" onClick={() => send('Look closely at this entity and respond in the current role-playing scene. Do not move or collect it unless asked.')}>{t("→ Look closer")}</button>}
    </div>
    </fieldset>
    {busy && <small role="status">{t("Working…")}</small>}
    {feedback && <small role="status">{feedback}</small>}
    {error && <small className="entity-action-error" role="alert">{error}</small>}
  </div>;
}
