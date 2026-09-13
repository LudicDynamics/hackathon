import React from 'react';
import { chalkStyleOf } from '@airp/shared/forms';
import { renderFrontmatterWidgets } from '../../lib/fm.js';
import { MarkdownText } from '../../lib/md.js';

interface ChalkCardProps {
  item: {
    path: string;
    filename: string;
    frontmatter: Record<string, unknown> | null;
    body: string;
  };
  /** When supplied, the card renders its own status/choice/dice widgets. */
  onSelectChoice?: (choiceText: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
}

/**
 * Chalk narration — ink on the canvas, not a card. The default form is `.chalk--bare`:
 * transparent surface, no border/shadow/radius, straight from the v2 prototype
 * (canvas-stack-mingyue.html `.chalk`). Style variants are opt-in frontmatter and
 * resolved by the shared `chalkStyleOf` table (§10.2).
 *
 * `SceneChalk` (the folder README shown as the entry Chalk) renders outside any
 * `.object`, so it gets no `EntityInteractions` layer: when `onSelectChoice` is
 * passed this card renders widgets itself, or the scene's choice/status/dice
 * would vanish (docs/doc-06 §E-series entry Chalk).
 */
export const ChalkCard: React.FC<ChalkCardProps> = ({
  item,
  onSelectChoice,
  onDiceRolled,
}) => {
  const { frontmatter, body, path } = item;
  const style = chalkStyleOf(frontmatter);

  const widgets = onSelectChoice || onDiceRolled
    ? renderFrontmatterWidgets(frontmatter, {
        filePath: path,
        reveal: true,
        onChoice: onSelectChoice,
        onDiceRolled,
      })
    : null;

  const classes = ['chalk', 'chalk--bare'];
  if (style.hand) classes.push('chalk--hand');
  if (style.big) classes.push('chalk--big');
  if (style.tone !== 'ink') classes.push(`chalk--${style.tone}`);
  if (style.card) classes.push('chalk--card');
  if (style.collapsed) classes.push('chalk--collapsed');
  if (style.aged) classes.push('chalk--aged');

  const size = Number(frontmatter?.size);
  const sizeStyle: React.CSSProperties & { '--chalk-size': string } = {
    '--chalk-size': `${Number.isFinite(size) && size > 0 ? size : style.big ? 29 : 26}px`,
  };

  return (
    <div className={classes.join(' ')} style={sizeStyle}>
      {/* Chalk narration body — transparent ink, pre-wrap preserved. */}
      <MarkdownText text={body} className="chalk__body" />
      {widgets}
    </div>
  );
};
