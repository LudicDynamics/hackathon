import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface GodModeToolbarProps {
  frozen: boolean;
  onToggleFreeze: () => void;
}

export const GodModeToolbar: React.FC<GodModeToolbarProps> = ({
  frozen,
  onToggleFreeze,
}) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper-card border border-ink/10 shadow-soft">
      <button
        type="button"
        onClick={onToggleFreeze}
        className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
          frozen
            ? 'bg-rust text-white shadow-sm animate-pulse'
            : 'bg-paper-wall text-ink/70 hover:text-ink'
        }`}
        title={frozen ? 'World is paused. Click to thaw' : 'Pause world agents'}
      >
        {frozen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        <span>{frozen ? 'World Frozen' : 'God Hand'}</span>
      </button>
    </div>
  );
};
