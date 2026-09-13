import { useLocale } from './i18n.js';
import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import { DiceRoller } from '../components/narrative/DiceRoller.js';
import { buildInteractiveFields, visibleChoiceOptions, type NormalizedOption } from '@airp/shared/frontmatter';

/**
 * Shared frontmatter widgets for every Markdown entity (doc-20 §2).
 * Renders the choice / status / roll_dice trio below the chalk body:
 *   - status  → collapsible key-value table; EVERY key is shown (unknown keys
 *     are never dropped); hover peeks it open, click pins it open.
 *   - choice  → action card group; clicking sends the option as the player's
 *     next input; hovering inverts to ink-on-paper (v2 ink-reverse).
 *   - roll_dice → delegated to the existing DiceRoller component.
 * Any structural doubt in the widget data (broken/unknown shapes) degrades the
 * WHOLE block to `null` so the card falls back to plain text — never a
 * half-rendered widget.
 */
export interface FrontmatterWidgetOptions {
  reveal?: boolean;
  filePath?: string;
  onChoice?: (choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
}

export function renderFrontmatterWidgets(
  frontmatter: Record<string, any> | null | undefined,
  opts: FrontmatterWidgetOptions = {},
): React.ReactElement | null {
  try {
    if (!frontmatter || typeof frontmatter !== 'object') return null;
    const interactive = buildInteractiveFields(frontmatter);
    const statusData = interactive.status?.data ?? null;
    const statusKeys = statusData ? Object.keys(statusData).length : 0;

    const choices = interactive.choice ? visibleChoiceOptions(interactive.choice) : [];
    const dice = interactive.roll_dice;

    if (statusKeys === 0 && choices.length === 0 && !dice) return null;

    return (
      <FrontmatterWidgets
        statusData={statusData}
        statusLabel={interactive.status?.label}
        reveal={opts.reveal}
        choices={choices}
        dice={dice}
        filePath={opts.filePath}
        onChoice={opts.onChoice}
        onDiceRolled={opts.onDiceRolled}
      />
    );
  } catch {
    // Broken widget data → card falls back to plain text.
    return null;
  }
}

interface FrontmatterWidgetsProps {
  reveal?: boolean;
  statusData: Record<string, unknown> | null;
  statusLabel?: string;
  choices: NormalizedOption[];
  dice: Record<string, any> | null;
  filePath?: string;
  onChoice?: (choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
}

const FrontmatterWidgets: React.FC<FrontmatterWidgetsProps> = ({
  reveal = false,
  statusData,
  statusLabel,
  choices,
  dice,
  filePath,
  onChoice,
  onDiceRolled,
}) => {
  const { t } = useLocale();
  // Status fold: hover peeks open, click pins, leaving collapses unless pinned.
  const [statusPinned, setStatusPinned] = useState(false);
  const [statusHover, setStatusHover] = useState(false);
  const statusOpen = statusPinned || statusHover;

  const [hoverChoice, setHoverChoice] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hovered || focused || reveal;
  const statusKeys = statusData ? Object.keys(statusData).length : 0;

  return (
    <div className="fm-block" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false); }}>
      <button type="button" className="fm-head" aria-expanded={open} aria-pressed={pinned} onClick={() => setPinned(value => !value)}>
        {t(pinned ? '▾ Pinned' : '▸ Interact')}{choices.length > 0 ? ` · ${t('{count} choices', { count: choices.length })}` : ''}{dice ? ` · ${t('Dice')}` : ''}{statusKeys ? ` · ${t('Status')}` : ''}
      </button>
      <div className="fm-body" hidden={!open}>
      {statusKeys > 0 && (
        <div
          className="mt-4 pt-3 border-t border-ink/10"
          onPointerEnter={() => setStatusHover(true)}
          onPointerLeave={() => setStatusHover(false)}
        >
          <button
            onClick={() => setStatusPinned((p) => !p)}
            className="flex items-center gap-1.5 text-xs text-ink/60 hover:text-ink font-mono transition-colors"
          >
            {statusOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <Activity className="w-3.5 h-3.5" />
            <span>{statusLabel ?? t('Status')} ({statusKeys})</span>
            {statusOpen && statusPinned && <span className="text-ink/40">{t("· pinned")}</span>}
          </button>

          {statusOpen && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono p-2.5 rounded-xl bg-paper-wall/50 border border-ink/5">
              {Object.entries(statusData!).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 px-1">
                  <span className="text-ink/60">{String(k).replace(/_/g, ' ')}:</span>
                  <span className="font-medium text-ink truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {dice && (
        <DiceRoller
          filePath={filePath ?? ''}
          rollDice={{
            ...dice,
            desc: typeof dice.desc === 'string' ? dice.desc : 'Check',
            expect: typeof dice.expect === 'string' ? dice.expect : '',
          }}
          onRollComplete={onDiceRolled}
        />
      )}

      {choices.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-mono text-ink/40 uppercase tracking-wider mb-1">
            {t('Advance the Story')}
          </div>
          {choices.map((choice, idx) => {
            const hovered = hoverChoice === idx;
            return (
              <button
                key={idx}
                disabled={!onChoice}
                onClick={() => onChoice?.(choice.label)}
                onPointerEnter={() => setHoverChoice(idx)}
                onPointerLeave={() => setHoverChoice(null)}
                // Ink-reverse hover: no `.ink-reverse` utility in CSS yet and the
                // `ink` color is not in tailwind.config, so apply the v2 token
                // pair inline (they follow TaskA's :root values automatically).
                style={hovered ? { background: 'var(--ink)', color: '#fbf8f1' } : undefined}
                className="w-full text-left px-4 py-2.5 rounded-2xl bg-paper-wall/70 border border-ink/10 text-sm font-sans text-ink transition-all flex items-center justify-between group hover:translate-x-1"
              >
                <span>{choice.index}. {choice.label}{choice.hint && <small className="block opacity-60">{choice.hint}</small>}</span>
                <CornerDownRight
                  className={`w-4 h-4 transition-colors ${
                    hovered ? 'text-[#fbf8f1]' : 'text-ink/30 group-hover:text-rust'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
