import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ChalkCard } from './ChalkCard.js';

interface SceneChalkProps {
  scene: {
    path: string;
    filename: string;
    frontmatter: Record<string, any> | null;
    body: string;
  } | null;
  label: string;
  collapseLabel: string;
  expandLabel: string;
  onSelectChoice?: (path: string, choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
}

/** The current folder README, presented as the scene's entry Chalk. */
export const SceneChalk: React.FC<SceneChalkProps> = ({
  scene,
  label,
  collapseLabel,
  expandLabel,
  onSelectChoice,
  onDiceRolled,
}) => {
  const [open, setOpen] = useState(true);

  useEffect(() => setOpen(true), [scene?.path]);
  if (!scene) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="scene-chalk scene-chalk--folded"
        onClick={() => setOpen(true)}
        title={expandLabel}
      >
        <ChevronDown className="w-4 h-4" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <section className="scene-chalk" data-no-drag>
      <div className="scene-chalk__head">
        <span>{label}</span>
        <button type="button" onClick={() => setOpen(false)} title={collapseLabel}>
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
      <ChalkCard
        item={scene}
        onSelectChoice={(choice) => onSelectChoice?.(scene.path, choice)}
        onDiceRolled={onDiceRolled}
      />
    </section>
  );
};
