import React, { useState, useEffect, useRef } from 'react';
import { DoorOpen, UserPlus, StickyNote, Feather, Sparkles, X, ArrowRight } from 'lucide-react';
import { playFoley } from '../../lib/audio.js';

export type RadialItemType = 'gate' | 'character' | 'clue' | 'chalk';

export interface RadialMenuProps {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  onClose: () => void;
  onCreate: (type: RadialItemType, title: string, content: string, wx: number, wy: number) => void;
}

const MENU_OPTIONS: Array<{
  type: RadialItemType;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgHover: string;
  angle: number; // in degrees
  placeholder: string;
}> = [
  {
    type: 'gate',
    label: 'New Scene',
    sub: 'Portal to uncharted space',
    icon: DoorOpen,
    color: 'text-sage',
    bgHover: 'hover:bg-sage/15 hover:border-sage/40',
    angle: -90, // Top
    placeholder: 'e.g. The Smuggler\'s Cellar beneath the river...',
  },
  {
    type: 'character',
    label: 'Summon NPC',
    sub: 'A living inhabitant of the world',
    icon: UserPlus,
    color: 'text-rust',
    bgHover: 'hover:bg-rust/15 hover:border-rust/40',
    angle: 0, // Right
    placeholder: 'e.g. A ragged apothecary selling forbidden tinctures...',
  },
  {
    type: 'clue',
    label: 'Place Clue',
    sub: 'Physical item or sticky note',
    icon: StickyNote,
    color: 'text-amber-700',
    bgHover: 'hover:bg-amber-100 hover:border-amber-400',
    angle: 90, // Bottom
    placeholder: 'e.g. An ivory pocket watch stained with fresh soot...',
  },
  {
    type: 'chalk',
    label: 'Inscribe Chalk',
    sub: 'Direct authorial narration',
    icon: Feather,
    color: 'text-blue',
    bgHover: 'hover:bg-blue/15 hover:border-blue/40',
    angle: 180, // Left
    placeholder: 'e.g. The floorboards groan as the fog seeps through...',
  },
];

export const RadialMenu: React.FC<RadialMenuProps> = ({
  x,
  y,
  worldX,
  worldY,
  onClose,
  onCreate,
}) => {
  const [selectedType, setSelectedType] = useState<RadialItemType | null>(null);
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // Focus input on form entry
  useEffect(() => {
    if (selectedType && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedType]);

  const activeOption = MENU_OPTIONS.find((o) => o.type === selectedType);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = prompt.trim();
    if (!text || !selectedType) return;
    playFoley('pen-scratch');
    const title = text.length > 28 ? text.slice(0, 25) + '...' : text;
    onCreate(selectedType, title, text, worldX, worldY);
    onClose();
  };

  // Keep menu within viewport bounds
  const menuLeft = Math.min(Math.max(x, 170), window.innerWidth - 170);
  const menuTop = Math.min(Math.max(y, 170), window.innerHeight - 170);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden select-none"
      onPointerDown={(e) => {
        // Prevent viewport capture from stealing gestures
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        // Click on backdrop closes
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      {/* Background dimmer */}
      <div
        className="absolute inset-0 bg-ink/35 backdrop-blur-[3px] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Radial Hub Container */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: menuLeft, top: menuTop }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!selectedType ? (
          /* Wheel mode: 4 satellites around central seal */
          <div className="relative w-64 h-64 flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
            {/* Center Hub */}
            <div className="w-20 h-20 rounded-full bg-paper-card border-2 border-ink/20 shadow-deep flex flex-col items-center justify-center text-center p-1 cursor-default">
              <Sparkles className="w-5 h-5 text-rust animate-pulse mb-0.5" />
              <span className="font-mono text-[8px] uppercase tracking-wider text-ink/70 font-semibold leading-tight">
                World<br />Studio
              </span>
            </div>

            {/* Satellites */}
            {MENU_OPTIONS.map((opt) => {
              const rad = (opt.angle * Math.PI) / 180;
              const radius = 96;
              const sx = Math.cos(rad) * radius;
              const sy = Math.sin(rad) * radius;
              const Icon = opt.icon;

              return (
                <button
                  key={opt.type}
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    playFoley('paper-slide', 0.6);
                    setSelectedType(opt.type);
                  }}
                  className={`absolute w-24 p-2 rounded-2xl bg-paper-card border border-ink/15 shadow-soft transition-all duration-200 flex flex-col items-center text-center group cursor-pointer hover:scale-105 active:scale-95 ${opt.bgHover}`}
                  style={{
                    left: `calc(50% + ${sx}px - 48px)`,
                    top: `calc(50% + ${sy}px - 32px)`,
                  }}
                >
                  <Icon className={`w-5 h-5 ${opt.color} group-hover:scale-110 transition-transform mb-1`} />
                  <span className="font-sans text-[11px] font-bold text-ink leading-tight">
                    {opt.label}
                  </span>
                  <span className="font-mono text-[8px] text-ink/50 leading-tight truncate w-full mt-0.5">
                    {opt.sub}
                  </span>
                </button>
              );
            })}

            {/* Quick close hint */}
            <button
              type="button"
              onClick={onClose}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-paper-card border border-ink/20 shadow-sm flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/10 text-xs font-mono transition-all"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Form mode: Tilted paper prompt bar to describe creation */
          <div className="w-96 p-5 rounded-3xl bg-paper-card border border-ink/15 shadow-deep -rotate-1 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {activeOption && <activeOption.icon className={`w-4 h-4 ${activeOption.color}`} />}
                <span className="font-serif text-sm font-bold text-ink">
                  {activeOption?.label} · Creator Mode
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="p-1 rounded-full hover:bg-ink/10 text-ink/60 cursor-pointer"
                title="Back to wheel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="font-mono text-[10px] text-ink/50 mb-3">
              Describe the entity. It will materialize at your clicked location with instant narrative feedback.
            </p>

            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeOption?.placeholder}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-paper-wall/70 border border-ink/15 text-xs text-ink placeholder:text-ink/40 focus:outline-none focus:border-rust font-sans"
              />
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-rust hover:bg-rust-light text-white disabled:opacity-30 transition-all cursor-pointer"
                title="Bring to life"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-ink/40">
              <span>Seated: ({Math.round(worldX)}, {Math.round(worldY)})</span>
              <span>Press Enter ↵ to form</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
