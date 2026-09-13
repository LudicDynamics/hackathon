import { useEffect, useState } from 'react';
import { emptyActivity, reduceActivity } from '../lib/agent-activity.js';
import { useLocale } from '../lib/i18n.js';
import './agent-activity.css';

/** Recent execution receipts, not model reasoning or speculative narration. */
export function AgentActivity({ worldKey }: { worldKey?: string }) {
  const { t } = useLocale();
  const [state, setState] = useState(emptyActivity);
  useEffect(() => {
    setState(emptyActivity());
    const receive = (event: Event) => setState(current => reduceActivity(current, (event as CustomEvent).detail ?? {}));
    window.addEventListener('airp:agent-frame', receive);
    return () => window.removeEventListener('airp:agent-frame', receive);
  }, [worldKey]);
  if (!state.entries.length && state.writerPhase === 'idle') return null;
  const last = state.entries.at(-1);
  return <aside className="agent-activity" aria-label={t('Agent activity')}>
    <p className="agent-activity__summary" role="status">
      {state.writerPhase === 'interrupted' ? t('Interrupted · completed changes are kept; this action is not confirmed complete.')
        : state.writerPhase === 'settled' ? t('Turn ended · {tools} tool calls completed · {changes} recorded changes', { tools: state.completed, changes: state.changes })
        : last ? `${t(last.label)} · ${t(last.state)}` : t('Reading the scene')}
    </p>
    <details open={state.writerPhase === 'working'}>
      <summary>{t('Execution log')} · {state.entries.length}</summary>
      <ol>{state.entries.map(entry => <li key={entry.id} data-state={entry.state}>
        <span>{entry.actor} · {t(entry.label)} · {t(entry.state)}{entry.kind === 'world' ? ` · ${t('Saved')}` : ''}</span>
        {entry.target && <small>{entry.target}</small>}
      </li>)}</ol>
    </details>
    {state.summary && state.writerPhase !== 'working' && <details><summary>{t('Writer closing message (not a completion check)')}</summary><p>{state.summary}</p></details>}
    <small>{t('Recent activity in this browser; tool success does not mean the puzzle is solved.')}</small>
  </aside>;
}
