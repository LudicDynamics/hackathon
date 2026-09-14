import React, { useEffect, useId, useRef, useState } from 'react';
import {
  activityAriaText,
  activityLabel,
  SOURCE_NAME_KEYS,
  type ActivityLogQuery,
  type AgentActivityLogTurn,
  type TFn,
} from '../../lib/agent-activity.js';
import { useLocale } from '../../lib/i18n.js';
import type { FocusCoordinator } from '../../lib/focus-coordinator.js';
import { useAgentActivityLog } from '../../state/useAgentActivity.js';

export interface AgentActivityLogProps {
  query: ActivityLogQuery;
  sessionLabel?: string;
  className?: string;
  focus?: FocusCoordinator;
}

function turnKey(turn: AgentActivityLogTurn): string {
  return `${turn.source}\u0000${turn.agentId}\u0000${turn.turnId}`;
}

function statusLabel(turn: AgentActivityLogTurn, t: TFn): string {
  if (turn.state === 'running') return t('In progress');
  if (turn.entries.some((entry) => entry.errorKind === 'cancelled')) return t('Stopped');
  if (turn.entries.some((entry) => entry.errorKind === 'timeout')) return t('Took too long');
  return turn.state === 'error' ? t('Not completed') : t('Completed');
}

export const AgentActivityLog: React.FC<AgentActivityLogProps> = ({ query, sessionLabel, className, focus }) => {
  const { turns, entryCount, aria } = useAgentActivityLog(query);
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const panelId = useId();
  const focusTokenRef = useRef<string | null>(null);
  const setOpenState = (next: boolean): void => {
    setOpen(next);
    const token = focusTokenRef.current;
    if (next && focus && !token) focusTokenRef.current = focus.acquire('workspace');
    if (!next && token && focus) {
      focus.release(token);
      focusTokenRef.current = null;
    }
  };
  useEffect(() => () => {
    const token = focusTokenRef.current;
    if (token && focus) focus.release(token);
  }, [focus]);

  if (entryCount === 0) return null;

  const toggleOpen = () => {
    if (!open) {
      const first = turns[0];
      setExpanded(first ? new Set([turnKey(first)]) : new Set());
    }
    setOpenState(!open);
  };
  const toggleTurn = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const expandAll = () => setExpanded(new Set(turns.map(turnKey)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div className={`agent-activity-log${className ? ` ${className}` : ''}`} data-focus-owner={open ? 'workspace' : undefined}>
      <p className="sr-only" aria-live="off">{aria}</p>
      <button
        type="button"
        className="agent-activity-log__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('Activity details')}
        onClick={toggleOpen}
      >
        <span className="agent-activity-log__toggle-mark" aria-hidden="true">≡</span>
        <span>{t('Activity details')}</span>
        <span className="agent-activity-log__count" aria-hidden="true">{entryCount}</span>
      </button>

      {open && (
        <section id={panelId} className="agent-activity-log__panel" aria-label={sessionLabel ? t('Activity details for {name}', { name: sessionLabel }) : t('Activity details')} onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setOpenState(false);
          }
        }}>
          <header className="agent-activity-log__header">
            <strong>{sessionLabel ?? t('Activity details')}</strong>
            <div className="agent-activity-log__actions">
              <button type="button" onClick={expandAll}>{t('Expand all activity turns')}</button>
              <button type="button" onClick={collapseAll}>{t('Collapse all activity turns')}</button>
              <button type="button" onClick={() => setOpenState(false)} aria-label={t('Close activity details')}>×</button>
            </div>
          </header>
          <ul className="agent-activity-log__turns">
            {turns.map((turn) => {
              const key = turnKey(turn);
              const isExpanded = expanded.has(key);
              const name = t(SOURCE_NAME_KEYS[turn.source]);
              const summary = t('{name} · {count} activities · {status}', {
                name,
                count: turn.entries.length,
                status: statusLabel(turn, t),
              });
              return (
                <li key={key} className="agent-activity-log__turn" data-state={turn.state}>
                  <button
                    type="button"
                    className="agent-activity-log__turn-toggle"
                    aria-expanded={isExpanded}
                    onClick={() => toggleTurn(key)}
                  >
                    <span className="agent-activity-log__chevron" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                    <span>{summary}</span>
                  </button>
                  <ul className="agent-activity-log__entries" hidden={!isExpanded}>
                    {turn.entries.map((entry) => (
                      <li key={entry.activityId} className="agent-activity-log__entry" data-state={entry.state} aria-label={activityAriaText(entry, t)}>
                        <span className="agent-activity-log__entry-dot" aria-hidden="true" />
                        <span>{activityLabel(entry, t)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};
