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
 * Canvas entities delegate widgets to EntityInteractions. Standalone readers
 * may explicitly pass handlers to render those widgets here.
 */
export const ChalkCard: React.FC<ChalkCardProps> = ({
  item,
  onSelectChoice,
  onDiceRolled,
}) => {
  const { frontmatter, body, path } = item;
  const style = chalkStyleOf(frontmatter);
  const roll = frontmatter?.roll_dice as { type?: string; result?: number; passed?: boolean } | undefined;

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
      {typeof roll?.result === 'number' && typeof roll.passed === 'boolean' && (
        <output className="chalk__dice-result" aria-live="polite" style={{ display: 'block', font: '600 16px/1.6 monospace', marginTop: 12 }}>
          {roll.type} → {roll.result} · {roll.passed ? '✓' : '✗'}
        </output>
      )}
      {widgets}
    </div>
  );
};
