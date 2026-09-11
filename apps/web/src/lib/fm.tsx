import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import { DiceRoller } from '../components/narrative/DiceRoller.js';

/**
 * Frontmatter widgets for `type: chalk` (doc-06 §2.6 / doc-05 §3.1).
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

    // status.data (or the whole status map when data is absent) — show all keys.
    const rawStatus =
      frontmatter.status && typeof frontmatter.status === 'object' ? frontmatter.status : null;
    const statusData =
      rawStatus &&
      rawStatus.data &&
      typeof rawStatus.data === 'object' &&
      !Array.isArray(rawStatus.data)
        ? rawStatus.data
        : rawStatus;
    const statusKeys = statusData ? Object.keys(statusData).length : 0;

    const choices = Array.isArray(frontmatter.choice) ? frontmatter.choice : [];
    const dice =
      frontmatter.roll_dice && typeof frontmatter.roll_dice === 'object'
        ? frontmatter.roll_dice
        : null;

    if (statusKeys === 0 && choices.length === 0 && !dice) return null;

    return (
      <FrontmatterWidgets
        statusData={statusData}
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
  statusData: Record<string, unknown> | null;
  choices: unknown[];
  dice: Record<string, any> | null;
  filePath?: string;
  onChoice?: (choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
}

const FrontmatterWidgets: React.FC<FrontmatterWidgetsProps> = ({
  statusData,
  choices,
  dice,
  filePath,
  onChoice,
  onDiceRolled,
}) => {
  // Status fold: hover peeks open, click pins, leaving collapses unless pinned.
  const [statusPinned, setStatusPinned] = useState(false);
  const [statusHover, setStatusHover] = useState(false);
  const statusOpen = statusPinned || statusHover;

  const [hoverChoice, setHoverChoice] = useState<number | null>(null);
  const statusKeys = statusData ? Object.keys(statusData).length : 0;

  return (
    <>
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
            <span>World State Snapshot ({statusKeys})</span>
            {statusOpen && statusPinned && <span className="text-ink/40">· pinned</span>}
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
            Advance the Story
          </div>
          {choices.map((choice, idx) => {
            const hovered = hoverChoice === idx;
            return (
              <button
                key={idx}
                onClick={() => onChoice?.(String(choice))}
                onPointerEnter={() => setHoverChoice(idx)}
                onPointerLeave={() => setHoverChoice(null)}
                // Ink-reverse hover: no `.ink-reverse` utility in CSS yet and the
                // `ink` color is not in tailwind.config, so apply the v2 token
                // pair inline (they follow TaskA's :root values automatically).
                style={hovered ? { background: 'var(--ink)', color: '#fbf8f1' } : undefined}
                className="w-full text-left px-4 py-2.5 rounded-2xl bg-paper-wall/70 border border-ink/10 text-sm font-sans text-ink transition-all flex items-center justify-between group hover:translate-x-1"
              >
                <span>{String(choice)}</span>
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
    </>
  );
};
