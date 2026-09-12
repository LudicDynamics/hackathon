import React from 'react';
import { chalkStyleOf } from '@airp/shared/forms';
import { renderFrontmatterWidgets } from '../../lib/fm.js';
import { MarkdownText } from '../../lib/md.js';

interface ChalkCardProps {
  item: {
    path: string;
    filename: string;
    frontmatter: Record<string, any> | null;
    body: string;
  };
  onSelectChoice?: (choiceText: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
}

/**
 * Chalk narration — ink on the canvas, not a card. The default form is `.chalk--bare`:
 * transparent surface, no border/shadow/radius, straight from the v2 prototype
 * (canvas-stack-mingyue.html `.chalk`). Style variants are opt-in frontmatter and
 * resolved by the shared `chalkStyleOf` table (§10.2).
 */
export const ChalkCard: React.FC<ChalkCardProps> = ({
  item,
  onSelectChoice,
  onDiceRolled,
}) => {
  const { frontmatter, body, path } = item;
  const style = chalkStyleOf(frontmatter);

  // status (hover-to-peek / click-to-pin fold) + choice group + dice card —
  // all widget rendering lives in lib/fm.ts; any broken frontmatter shape
  // degrades there to null, leaving this card as plain narration text.
  const widgets = renderFrontmatterWidgets(frontmatter, {
    filePath: path,
    onChoice: onSelectChoice,
    onDiceRolled,
  });

  const classes = ['chalk', 'chalk--bare'];
  if (style.hand) classes.push('chalk--hand');
  if (style.big) classes.push('chalk--big');
  if (style.tone !== 'ink') classes.push(`chalk--${style.tone}`);
  if (style.card) classes.push('chalk--card');
  if (style.collapsed) classes.push('chalk--collapsed');
  if (style.aged) classes.push('chalk--aged');

  const size = Number(frontmatter?.size);
  const sizeStyle = Number.isFinite(size)
    ? ({ '--chalk-size': `${size}px` } as React.CSSProperties)
    : undefined;

  return (
    <div className={classes.join(' ')} style={sizeStyle}>
      {/* Chalk narration body — transparent ink, pre-wrap preserved. */}
      <MarkdownText text={body} className="whitespace-pre-wrap" />

      {widgets}
    </div>
  );
};
