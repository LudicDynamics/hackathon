import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Activity, CornerDownRight } from 'lucide-react';
import { DiceRoller } from './DiceRoller.js';

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

export const ChalkCard: React.FC<ChalkCardProps> = ({
  item,
  onSelectChoice,
  onDiceRolled,
}) => {
  const [statusOpen, setStatusOpen] = useState(false);
  const { frontmatter, body, path } = item;

  const statusData = frontmatter?.status?.data;
  const choices = frontmatter?.choice;
  const rollDice = frontmatter?.roll_dice;

  return (
    <div className="w-full p-6 rounded-3xl bg-paper-card text-paper-ink shadow-halo border border-ink/5 backdrop-blur-sm transition-all hover:shadow-deep">
      {/* Chalk narration body */}
      <div className="font-serif text-lg leading-relaxed text-ink/90 whitespace-pre-line tracking-wide">
        {body}
      </div>

      {/* Frontmatter Status Table (Collapsible) */}
      {statusData && Object.keys(statusData).length > 0 && (
        <div className="mt-4 pt-3 border-t border-ink/10">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className="flex items-center gap-1.5 text-xs text-ink/60 hover:text-ink font-mono transition-colors"
          >
            {statusOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <Activity className="w-3.5 h-3.5" />
            <span>World State Snapshot ({Object.keys(statusData).length})</span>
          </button>

          {statusOpen && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono p-2.5 rounded-xl bg-paper-wall/50 border border-ink/5">
              {Object.entries(statusData).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 px-1">
                  <span className="text-ink/60">{k}:</span>
                  <span className="font-medium text-ink truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Frontmatter Roll Dice */}
      {rollDice && (
        <DiceRoller
          filePath={path}
          rollDice={rollDice}
          onRollComplete={onDiceRolled}
        />
      )}

      {/* Frontmatter Choice Card Group */}
      {choices && choices.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="text-xs font-mono text-ink/40 uppercase tracking-wider mb-1">
            Advance the Story
          </div>
          {choices.map((choice: string, idx: number) => (
            <button
              key={idx}
              onClick={() => onSelectChoice?.(choice)}
              className="w-full text-left px-4 py-2.5 rounded-2xl bg-paper-wall/70 hover:bg-paper-wall border border-ink/10 text-sm font-sans text-ink transition-all flex items-center justify-between group hover:translate-x-1"
            >
              <span>{choice}</span>
              <CornerDownRight className="w-4 h-4 text-ink/30 group-hover:text-rust transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
