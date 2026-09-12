import React from 'react';
import { renderFrontmatterWidgets } from '../../lib/fm.js';

interface Props {
  item: { path: string; frontmatter: Record<string, any> | null };
  onChoice?: (prompt: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
}

/** Shared by every Markdown form; visual form never decides interaction support. */
export function EntityInteractions({ item, onChoice, onDiceRolled }: Props) {
  const send = (action: string) => onChoice?.(`Regarding world file ${JSON.stringify(item.path)}, the player requests: ${action}`);
  const actions = Array.isArray(item.frontmatter?.actions)
    ? item.frontmatter.actions.filter((action: unknown): action is string => typeof action === 'string' && !!action.trim())
    : [];
  return <div className="entity-interactions" data-no-drag onClick={event => event.stopPropagation()}>
    {renderFrontmatterWidgets(item.frontmatter, { filePath: item.path, onChoice: send, onDiceRolled })}
    {actions.length > 0 && <div className="entity-action-arrows" aria-label="Entity actions">
      {actions.map((action: string, index: number) => <button type="button" key={`${index}-${action}`} disabled={!onChoice} onClick={() => send(action)}>{action}<span aria-hidden="true"> ↗</span></button>)}
    </div>}
  </div>;
}
