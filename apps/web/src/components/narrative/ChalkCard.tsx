import React from 'react';
import { chalkStyleOf } from '@airp/shared/forms';
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
}) => {
  const { frontmatter, body } = item;
  const style = chalkStyleOf(frontmatter);

  const classes = ['chalk', 'chalk--bare'];
  if (style.hand) classes.push('chalk--hand');
  if (style.big) classes.push('chalk--big');
  if (style.tone !== 'ink') classes.push(`chalk--${style.tone}`);
  if (style.card) classes.push('chalk--card');
  if (style.collapsed) classes.push('chalk--collapsed');
  if (style.aged) classes.push('chalk--aged');

  const size = Number(frontmatter?.size);
  const sizeStyle = { '--chalk-size': `${Number.isFinite(size) && size > 0 ? size : style.big ? 29 : 26}px` } as React.CSSProperties;

  return (
    <div className={classes.join(' ')} style={sizeStyle}>
      {/* Chalk narration body — transparent ink, pre-wrap preserved. */}
      <MarkdownText text={body} className="chalk__body" />

    </div>
  );
};
