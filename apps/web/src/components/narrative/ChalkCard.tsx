import React from 'react';
import { chalkStyleOf } from '@airp/shared/forms';
import { renderFrontmatterWidgets } from '../../lib/fm.js';
import { MarkdownText } from '../../lib/md.js';
import { useLocale } from '../../lib/i18n.js';
import type { AppearanceView } from '../../lib/appearance-view.js';

interface ChalkCardProps {
  item: {
    path: string;
    filename: string;
    frontmatter: Record<string, unknown> | null;
    body: string;
  };
  /**
   * The verified view CanvasObject already injected into `.object` (04 §:101). When an
   * appearance axis is present it wins over the legacy class, which is why the `hand` /
   * tone / `card` classes below are skipped whenever the resolution chose that axis.
   */
  appearance?: AppearanceView | null;
  /** When supplied, the card renders its own status/choice/dice widgets. */
  onSelectChoice?: (choiceText: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
}

/**
 * Chalk narration — ink on the canvas, not a card. The default form is `.chalk--bare`:
 * transparent surface, no border/shadow/radius, straight from the v2 prototype
 * (canvas-stack-mingyue.html `.chalk`). Legacy style variants are opt-in frontmatter and
 * resolved by the shared `chalkStyleOf` table (§10.2); the `appearance` namespace, when the
 * resolver chose an axis, supersedes the equivalent legacy class (00 §4 rule 7, 04 §:101).
 *
 * Canvas entities delegate widgets to EntityInteractions. Standalone readers
 * may explicitly pass handlers to render those widgets here.
 */
export const ChalkCard: React.FC<ChalkCardProps> = ({
  item,
  appearance,
  onSelectChoice,
  onDiceRolled,
}) => {
  const { frontmatter, body, path } = item;
  const { locale } = useLocale();
  const resolved = /<!--\s*resolved-dice:\s*(\d+)\s*-->/.exec(body);
  const narrative = frontmatter?.dice_outcomes
    ? (resolved ? body.slice(resolved.index + resolved[0].length) : String(frontmatter.dice_scene_text ?? (locale === 'ja' ? 'まだ、確かめられる手掛かりがある。' : locale === 'zh-CN' ? '这里还有值得查证的线索。' : 'There are still clues here to examine.')))
    : body;
  const style = chalkStyleOf(frontmatter);
  const roll = frontmatter?.roll_dice as { type?: string; result?: number; passed?: boolean } | undefined;

  // Only a var the adapter actually emitted means the resolution chose that axis; an
  // unset axis leaves the class in charge, preserving legacy paint exactly.
  const styled = appearance?.style;
  const fontChosen = Boolean(styled?.['--appearance-font-family']);
  const inkChosen = Boolean(styled?.['--appearance-ink']);
  const surfaceChosen = styled?.['--appearance-surface'] !== undefined && styled?.['--appearance-surface'] !== 'transparent';

  const widgets = onSelectChoice || onDiceRolled
    ? renderFrontmatterWidgets(frontmatter, {
        filePath: path,
        reveal: true,
        onChoice: onSelectChoice,
        onDiceRolled,
      })
    : null;

  const classes = ['chalk', 'chalk--bare'];
  if (style.hand && !fontChosen) classes.push('chalk--hand');
  if (style.big) classes.push('chalk--big');
  if (style.tone !== 'ink' && !inkChosen) classes.push(`chalk--${style.tone}`);
  if (style.card && !surfaceChosen) classes.push('chalk--card');
  if (style.collapsed) classes.push('chalk--collapsed');
  if (style.aged) classes.push('chalk--aged');

  const size = Number(frontmatter?.size);
  const sizeStyle: React.CSSProperties & { '--chalk-size': string } = {
    '--chalk-size': `${Number.isFinite(size) && size > 0 ? size : style.big ? 29 : 26}px`,
  };

  return (
    <div className={classes.join(' ')} {...appearance?.attrs} style={{ ...(appearance?.style ?? {}), ...sizeStyle }}>
      {/* Chalk narration body — transparent ink, pre-wrap preserved. */}
      {resolved ? <details className="dice-outcome-letter" data-no-drag onClick={e => e.stopPropagation()}><summary>✉ {locale === 'ja' ? '結果の記録を開く' : locale === 'zh-CN' ? '展开结果记录' : 'Open outcome record'}</summary><MarkdownText text={narrative} className="chalk__body" /></details> : <MarkdownText text={narrative} className="chalk__body" />}
      {typeof roll?.result === 'number' && typeof roll.passed === 'boolean' && (
        <output className="chalk__dice-result" aria-live="polite" style={{ display: 'block', font: '600 16px/1.6 monospace', marginTop: 12 }}>
          {roll.type} → {roll.result} · {frontmatter?.dice_grade === 'great-success' ? (locale === 'ja' ? '大成功' : locale === 'zh-CN' ? '大成功' : 'Great success') : roll.passed ? (locale === 'ja' ? '成功' : locale === 'zh-CN' ? '成功' : 'Success') : (locale === 'ja' ? '不成功' : locale === 'zh-CN' ? '未成功' : 'Unsuccessful')}
        </output>
      )}
      {widgets}
    </div>
  );
};
