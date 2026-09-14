import { useLocale } from '../../lib/i18n.js';
import React from 'react';
import { DeclaredActionDialog, type DeclaredResponse, type MaterialSelection } from './DeclaredActionDialog.js';
import './declared-actions.css';
import { airpGateway, AirpRequestError } from '../../lib/airp-gateway.js';
import { actionDetailsOf, actionKey, ActionFeedbackStore, runAction, type ActionFeedback, type ActionResultLike, type ActionVerb } from '../../lib/action-feedback.js';
import { renderFrontmatterWidgets } from '../../lib/fm.js';
import { holdReveal, settleReveal } from '../../lib/dice-ceremony.js';

interface Props {
  item: { path: string; filename?: string; body?: string; frontmatter: Record<string, any> | null };
  active?: boolean;
  onChoice?: (prompt: string) => void;
  onSelectChoice?: (path: string, choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (path: string) => void;
  onOpenCharacter?: (id: string) => void;
  onActionResult?: (result: ActionFeedback) => void;
  /** A choice picked in the canvas reader; run here, then acknowledged. */
  pendingChoice?: string | null;
  onPendingChoiceHandled?: () => void;
}

type DeclaredChoiceDetails = {
  action: DeclaredResponse;
};

type MaterialReviewDetails = {
  prompt: string;
  materials: Array<{ slot: string; path: string; revision: string }>;
};

function declaredActionOf(value: unknown): DeclaredResponse | null {
  if (!value || typeof value !== 'object') return null;
  const action = value as Record<string, unknown>;
  if (!['read', 'take', 'stage', 'enter', 'character', 'reply', 'writer'].includes(String(action.kind))
    || typeof action.source !== 'string'
    || (typeof action.choice !== 'string' && typeof action.choice !== 'number')
    || typeof action.revision !== 'string'
    || !Array.isArray(action.items)
    || !Array.isArray(action.missing)) return null;
  if (action.kind === 'stage' && !Array.isArray(action.slots)) return null;
  return action as DeclaredResponse;
}


export function EntityInteractions({ item, active = false, onChoice, onDiceRolled, onEnterGate, onOpenCharacter, onActionResult, pendingChoice, onPendingChoiceHandled }: Props) {
  const { t } = useLocale();
  const [busy, setBusy] = React.useState(false);
  const [feedbackStatus, setFeedbackStatus] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState('');
  const [error, setError] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  const running = React.useRef(false);
  const feedbackStore = React.useMemo(() => new ActionFeedbackStore(), []);
  const [side, setSide] = React.useState('right');
  const [direct, setDirect] = React.useState<DeclaredResponse | null>(null);

  React.useLayoutEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const object = el.closest<HTMLElement>('.object');
    // The canvas root carries the world depth marker; the old aria-label hook no
    // longer exists, and the fallback (the camera-transformed world layer) moves
    // with the camera, which shrank max-height and clipped the panel.
    const viewport = object?.closest<HTMLElement>('.depth-surface--world')
      || object?.closest<HTMLElement>('[aria-label="Infinite canvas"]')
      || object?.parentElement?.parentElement;
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

  const runGatewayAction = async <TDetails,>(verb: ActionVerb, target: string, request: () => Promise<unknown>, acceptedMessage?: string): Promise<ActionFeedback<TDetails> | null> => {
    if (running.current) return null;
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
    return result;
  };

  const send = (action: string) => onChoice?.(`Regarding world file ${JSON.stringify(item.path)}, the player requests: ${action}`);
  const actions = Array.isArray(item.frontmatter?.actions)
    ? item.frontmatter.actions.filter((action: unknown): action is string => typeof action === 'string' && !!action.trim())
    : [];
  const fm = item.frontmatter;
  const isGate = fm?.type === 'gate' || item.path.endsWith('/README.md');
  const isDoor = fm?.visual === 'door';
  const isPerson = fm?.type === 'character' || fm?.type === 'sprite';
  const collectable = !isGate && !isDoor && !isPerson && fm?.type !== 'chalk' && item.path.startsWith('world/') && fm?.portable !== false;
  // A declared roll that has not landed yet: its result is written before the ceremony plays.
  const rollPending = Boolean(fm?.dice_outcomes) && !/<!--\s*resolved-dice:/.test(item.body ?? '');

  const handleDeclaredAction = (action: DeclaredResponse) => {
    if (action.kind === 'enter' && typeof action.target === 'string') {
      setDirect(null);
      onEnterGate?.(action.target);
    } else if (action.kind === 'character' && typeof action.character === 'string') {
      setDirect(null);
      onOpenCharacter?.(action.character);
    } else if (action.kind === 'writer' && typeof action.prompt === 'string' && action.prompt.trim() && onChoice) {
      setDirect(null);
      onChoice(action.prompt);
    } else {
      setDirect(action);
    }
  };

  const executeDeclaredChoice = async (source: string, choice: string) => {
    const rolling = rollPending && source === item.path;
    if (rolling) holdReveal(source);
    const result = await runGatewayAction<DeclaredChoiceDetails>('choice', `${source}:${choice}`, async () => {
      const response = await airpGateway.choose(source, choice) as ActionResultLike<DeclaredChoiceDetails>;
      if ('ok' in response && response.ok === true) {
        const details = actionDetailsOf<DeclaredChoiceDetails>(response);
        if (!details || !declaredActionOf(details.action)) throw new Error('The declared action response is invalid. Refresh this card.');
      }
      return response;
    });
    if (rolling) settleReveal(source, result?.outcome === 'accepted' ? undefined : 0);
    if (result?.outcome !== 'accepted' || !result.details) return;
    const action = declaredActionOf(result.details.action);
    if (!action) return;
    handleDeclaredAction(action);
  };

  const choose = (choice: string) => {
    // Choices are domain actions, not writer prompts. Only the authoritative
    // `/api/choice` result can produce accepted/conflict/failed feedback.
    if (fm?.choice_actions && typeof fm.choice_actions === 'object') {
      void executeDeclaredChoice(item.path, choice);
      return;
    }
    void runGatewayAction('choice', `${item.path}:${choice}`, () => airpGateway.choose(item.path, choice));
  };

  // The reader posted nothing itself: run its choice through the same path as the panel.
  React.useEffect(() => {
    if (!pendingChoice) return;
    onPendingChoiceHandled?.();
    choose(pendingChoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChoice]);

  const requestMaterialReview = async (action: DeclaredResponse, selections: MaterialSelection[]) => {
    const response = await fetch('/api/material-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ world: action.world, path: action.source, choice: action.choice, revision: action.revision, selections }),
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AirpRequestError(`POST /api/material-review -> ${response.status}`, response.status, null);
    }
    if (!payload || typeof payload !== 'object') {
      throw new AirpRequestError(`POST /api/material-review -> ${response.status}`, response.status, null);
    }
    const result = payload as ActionResultLike<MaterialReviewDetails>;
    if (!response.ok) throw new AirpRequestError(`POST /api/material-review -> ${response.status}`, response.status, payload as Record<string, unknown>);
    if ('ok' in result && result.ok === true) {
      const details = actionDetailsOf<MaterialReviewDetails>(result);
      if (!details || typeof details.prompt !== 'string' || !Array.isArray(details.materials)) {
        throw new Error('The material review response is invalid. Reopen the panel.');
      }
    }
    return result;
  };

  const submitMaterialReview = async (selections: MaterialSelection[]): Promise<string> => {
    if (!direct) throw new Error('The action snapshot is no longer available. Reopen the panel.');
    const result = await runGatewayAction<MaterialReviewDetails>('present', direct.source, () => requestMaterialReview(direct, selections));
    if (result?.outcome !== 'accepted' || !result.details) throw new Error(result?.message ?? 'The review draft was not accepted.');
    return result.details.prompt;
  };

  const actionsPanel = <>
    <fieldset disabled={busy} aria-busy={busy}>
      {renderFrontmatterWidgets(item.frontmatter, { filePath: item.path, reveal: active, onChoice: choose, onDiceRolled })}
      <div className="entity-action-arrows" aria-label={t('Entity actions')}>
        {actions.map((action: string, index: number) => <button type="button" key={`${index}-${action}`} disabled={!onChoice} onClick={() => send(action)}><span aria-hidden="true">→ </span>{action}</button>)}
        {collectable && <button type="button" onClick={() => void runGatewayAction('move', item.path, () => airpGateway.move(item.path, `player/${item.path.split('/').pop()}`), t('Added to belongings.'))}>{t('→ Take along')}</button>}
        {(isGate || isDoor) && onEnterGate && <button type="button" onClick={() => onEnterGate(typeof fm?.target === 'string' ? fm.target : item.path.replace(/\/README\.md$/, ''))}>{t('→ Enter scene')}</button>}
        {isPerson && onOpenCharacter && <button type="button" onClick={() => onOpenCharacter(fm?.characterId || fm?.id || item.path.split('/').pop()!.replace(/\.md$/, ''))}>{t('→ Talk')}</button>}
      </div>
    </fieldset>
    {busy && <small role="status">{t('Working…')}</small>}
    {feedback && <small role="status" data-action-status={feedbackStatus ?? 'accepted'}>{feedback}</small>}
    {error && <small className="entity-action-error" role="alert" data-action-status={feedbackStatus ?? 'failed'}>{error}</small>}
  </>;


  return <div ref={ref} className={`entity-interactions entity-interactions--${side}`} data-no-drag onClick={event => event.stopPropagation()}>
    {actionsPanel}
    {direct && <DeclaredActionDialog
      key={`${direct.source}:${String(direct.choice)}:${direct.revision}`}
      value={direct}
      onClose={() => setDirect(null)}
      onChoose={executeDeclaredChoice}
      onSubmit={submitMaterialReview}
      onSendReview={prompt => {
        if (!onChoice) {
          setError('The writer input is unavailable. Return to the scene.');
          return;
        }
        onChoice(prompt);
        setDirect(null);
      }}
    />}
  </div>;

}
