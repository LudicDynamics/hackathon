import React from 'react';
import { renderFrontmatterWidgets } from '../../lib/fm.js';

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
  const { frontmatter, body, path } = item;

  // status (hover-to-peek / click-to-pin fold) + choice group + dice card —
  // all widget rendering lives in lib/fm.ts; any broken frontmatter shape
  // degrades there to null, leaving this card as plain narration text.
  const widgets = renderFrontmatterWidgets(frontmatter, {
    filePath: path,
    onChoice: onSelectChoice,
    onDiceRolled,
  });

  return (
    <div className="w-full p-6 rounded-3xl bg-paper-card text-paper-ink shadow-halo border border-ink/5 backdrop-blur-sm transition-all hover:shadow-deep">
      {/* Chalk narration body */}
      <div className="font-serif text-lg leading-relaxed text-ink/90 whitespace-pre-line tracking-wide">
        {body}
      </div>

      {widgets}
    </div>
  );
};
