import { useLocale } from '../../lib/i18n.js';
import React from 'react';
import { BagItemDialog } from '../BagItemDialog.js';
import { airpGateway } from '../../lib/airp-gateway.js';
import { renderFrontmatterWidgets } from '../../lib/fm.js';
import {
  actionKey,
  ActionFeedbackStore,
  runAction,
  type ActionFeedback,
  type ActionResultLike,
  type ActionVerb,
} from '../../lib/action-feedback.js';

interface Props {
  item: { path: string; filename?: string; body?: string; frontmatter: Record<string, any> | null };
  active?: boolean;
  onChoice?: (prompt: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (path: string) => void;
  onOpenCharacter?: (id: string) => void;
  onActionResult?: (result: ActionFeedback) => void;
}

/** Shared by every Markdown form; visual form never decides interaction support. */
function requestCanvasReading(source: HTMLElement): void {
  const object = source.closest<HTMLElement>('.object');
  if (!object) return;
  // CanvasObject already owns the reading projection and its keyboard seam.
  // Re-enter that seam rather than sending an action or fabricating feedback.
  object.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  }));
}
export function EntityInteractions({ item, active = false, onChoice, onDiceRolled, onEnterGate, onOpenCharacter, onActionResult }: Props) {
  const { t } = useLocale();
  const [busy, setBusy] = React.useState(false);
  const [feedbackStatus, setFeedbackStatus] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState('');
  const [error, setError] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  const running = React.useRef(false);
  const feedbackStore = React.useMemo(() => new ActionFeedbackStore(), []);
  const [side, setSide] = React.useState('right');
  const [inspecting, setInspecting] = React.useState(false);

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

  const publish = (result: ActionFeedback, acceptedMessage?: string) => {
    onActionResult?.(result);
    setFeedbackStatus(result.outcome);
    if (result.outcome === 'accepted') {
      setFeedback(acceptedMessage ?? result.message);
      setError('');
    } else if (result.outcome === 'conflict') {
      setFeedback(result.message);
      setError('');
    } else if (result.outcome === 'rejected' || result.outcome === 'failed') {
      setFeedback('');
      setError(result.message);
    }
  };

  const runGatewayAction = async <TDetails,>(verb: ActionVerb, target: string, request: () => Promise<unknown>, acceptedMessage?: string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError(''); setFeedback('');
    // Gateway returns the server's `{ok: true, ...details}` JSON shape. The
    // adapter validates/classifies it; this cast does not invent a response.
    const result = await runAction<TDetails>(
      feedbackStore,
      { key: actionKey(verb, target), verb, target },
      async () => await request() as ActionResultLike<TDetails>,
    );
    publish(result, acceptedMessage);
    running.current = false;
    setBusy(false);
  };

  const send = (action: string) => onChoice?.(`Regarding world file ${JSON.stringify(item.path)}, the player requests: ${action}`);
  const actions = Array.isArray(item.frontmatter?.actions)
    ? item.frontmatter.actions.filter((action: unknown): action is string => typeof action === 'string' && !!action.trim())
    : [];
  const fm = item.frontmatter;
  const isGate = fm?.type === 'gate' || item.path.endsWith('/README.md');
  const isPerson = fm?.type === 'character' || fm?.type === 'sprite';
  const collectable = !isGate && !isPerson && fm?.type !== 'chalk' && item.path.startsWith('world/') && fm?.portable !== false;
  const hasBody = typeof item.body === 'string' && item.body.trim().length > 0;
  const canvasReadingAllowed = !isGate && fm?.type !== 'sprite';
  const canRead = hasBody && canvasReadingAllowed;
  const choose = (choice: string) => {
    // Choices are domain actions, not writer prompts. Only the authoritative
    // `/api/choice` result can produce accepted/conflict/failed feedback.
    void runGatewayAction('choice', `${item.path}:${choice}`, () => airpGateway.choose(item.path, choice));
  };
  const inspect = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setError('');
    setFeedback('');
    setFeedbackStatus(null);
    setInspecting(true);
    // A body-bearing, readable CanvasObject owns the canonical projection.
    // Empty/non-readable entities stay local so they still get a visible
    // read-only empty state instead of a no-op or fabricated status.
    if (canRead) requestCanvasReading(event.currentTarget);
  };

  const readingItem = {
    path: item.path,
    filename: item.filename ?? item.path.split('/').pop() ?? item.path,
    body: item.body ?? '',
    frontmatter: item.frontmatter,
  };

  const actionsPanel = <>
    <fieldset disabled={busy} aria-busy={busy}>
      {renderFrontmatterWidgets(item.frontmatter, { filePath: item.path, reveal: active, onChoice: choose, onDiceRolled })}
      <div className="entity-action-arrows" aria-label={t('Entity actions')}>
        {actions.map((action: string, index: number) => <button type="button" key={`${index}-${action}`} disabled={!onChoice} onClick={() => send(action)}><span aria-hidden="true">→ </span>{action}</button>)}
        {collectable && <button type="button" onClick={() => void runGatewayAction('move', item.path, () => airpGateway.move(item.path, `player/${item.path.split('/').pop()}`), t('Added to belongings.'))}>{t('→ Take along')}</button>}
        <button type="button" onClick={inspect}>{t('→ Look closer')}</button>
        {isGate && onEnterGate && <button type="button" onClick={() => onEnterGate(typeof fm?.target === 'string' ? fm.target : item.path.replace(/\/README\.md$/, ''))}>{t('→ Enter scene')}</button>}
        {isPerson && onOpenCharacter && <button type="button" onClick={() => onOpenCharacter(fm?.characterId || fm?.id || item.path.split('/').pop()!.replace(/\.md$/, ''))}>{t('→ Talk')}</button>}
      </div>
    </fieldset>
    {busy && <small role="status">{t('Working…')}</small>}
    {feedback && <small role="status" data-action-status={feedbackStatus ?? 'accepted'}>{feedback}</small>}
    {error && <small className="entity-action-error" role="alert" data-action-status={feedbackStatus ?? 'failed'}>{error}</small>}
  </>;

  const readingProjection = <>
    <BagItemDialog
      inline
      item={{ ...readingItem, body: canRead ? readingItem.body : '' }}
      onClose={() => setInspecting(false)}
    />
    {!canRead && <small role="status">{t('Nothing readable here.')}</small>}
  </>;

  return <div ref={ref} className={`entity-interactions entity-interactions--${side}`} data-no-drag onClick={event => event.stopPropagation()}>
    {inspecting ? readingProjection : actionsPanel}
  </div>;

}
