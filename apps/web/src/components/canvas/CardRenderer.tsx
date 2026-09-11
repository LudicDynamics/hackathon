import React, { useState } from 'react';
import { DoorOpen, Mail, FileText, User } from 'lucide-react';
import { ChalkCard } from '../narrative/ChalkCard.js';
import { MarkdownText } from '../../lib/md.js';

interface CardRendererProps {
  item: {
    path: string;
    filename: string;
    frontmatter: Record<string, any> | null;
    body: string;
  };
  onSelectChoice?: (choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (targetLayer: string) => void;
  onOpenCharacterModal?: (charId: string) => void;
  onItemDropOnTarget?: (draggedItemPath: string, targetPath: string) => void;
}

export const CardRenderer: React.FC<CardRendererProps> = ({
  item,
  onSelectChoice,
  onDiceRolled,
  onEnterGate,
  onOpenCharacterModal,
  onItemDropOnTarget,
}) => {
  const { frontmatter, body, filename, path } = item;
  const [letterOpen, setLetterOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 1. Chalk Card
  if (frontmatter?.type === 'chalk') {
    return (
      <ChalkCard
        item={item}
        onSelectChoice={onSelectChoice}
        onDiceRolled={onDiceRolled}
      />
    );
  }

  // 2. Gate Card (Sub-scene portal)
  if (frontmatter?.type === 'gate' || filename === 'README.md') {
    const isStub = frontmatter?.stub || false;
    const title = frontmatter?.title || filename.replace('.md', '');
    return (
      <div
        onClick={() => {
          const target = frontmatter?.target || path.replace('/README.md', '');
          onEnterGate?.(target);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const draggedPath = e.dataTransfer.getData('text/plain');
          if (draggedPath) onItemDropOnTarget?.(draggedPath, path);
        }}
        className={`w-full p-5 rounded-3xl cursor-pointer border transition-all hover:scale-[1.02] shadow-soft ${
          isDragOver ? 'border-rust ring-2 ring-rust/30 bg-rust/5' : 'border-ink/10 bg-paper-card'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-2xl bg-sage/10 text-sage">
            <DoorOpen className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-sans font-bold text-ink text-sm">{title}</h4>
            <span className="font-mono text-[10px] text-ink/40 uppercase tracking-widest">
              {isStub ? 'UNWRITTEN · STUB' : 'SCENE · ENTRANCE'}
            </span>
          </div>
        </div>
        <p className="text-xs text-ink/70 font-sans line-clamp-2 leading-relaxed">
          {body}
        </p>
      </div>
    );
  }

  // 3. Letter Component Card
  if (frontmatter?.type === 'component' && frontmatter?.component === 'letter') {
    return (
      <>
        <div
          onClick={() => setLetterOpen(true)}
          className="w-full p-4 rounded-3xl bg-[#FCF8EC] border border-amber-900/10 shadow-soft cursor-pointer hover:shadow-deep transition-all hover:-translate-y-1"
        >
          <div className="flex items-center gap-2 text-rust mb-2">
            <Mail className="w-4 h-4" />
            <span className="font-sans font-semibold text-xs tracking-wider">
              {frontmatter.title || 'Letter'}
            </span>
          </div>
          <p className="text-xs text-ink/70 font-serif italic line-clamp-2">
            {frontmatter.preview || body}
          </p>
          <div className="mt-3 flex justify-between items-center text-[10px] font-mono text-ink/40">
            <span>Click to open and read</span>
            {frontmatter.sign && <span>{frontmatter.sign}</span>}
          </div>
        </div>

        {letterOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setLetterOpen(false)}
          >
            <div
              className="w-full max-w-lg p-8 rounded-3xl bg-[#FFFEF6] text-ink shadow-deep border border-ink/10 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-serif text-2xl font-bold text-ink mb-4">
                {frontmatter.title}
              </h3>
              <div className="font-serif text-base leading-relaxed text-ink/90 whitespace-pre-line mb-6">
                {frontmatter.body || body}
              </div>
              {frontmatter.sign && (
                <div className="text-right font-hand text-2xl text-rust">
                  —— {frontmatter.sign}
                </div>
              )}
              <div className="mt-6 text-center">
                <button
                  onClick={() => setLetterOpen(false)}
                  className="px-6 py-2 rounded-full bg-paper-wall hover:bg-ink hover:text-white text-xs font-mono transition-all"
                >
                  Fold & Put Away (Esc)
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // 4. Note / Clue Card (Default)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const draggedPath = e.dataTransfer.getData('text/plain');
        if (draggedPath) onItemDropOnTarget?.(draggedPath, path);
      }}
      className={`w-full p-4 rounded-3xl bg-paper-card border transition-all shadow-soft hover:shadow-deep ${
        isDragOver ? 'border-rust ring-2 ring-rust/30 bg-rust/5' : 'border-ink/10'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-4 h-4 text-blue" />
        <span className="font-sans font-semibold text-xs text-ink truncate">
          {frontmatter?.title || filename.replace('.md', '')}
        </span>
      </div>
      <MarkdownText
        text={body}
        className="text-xs text-ink/80 font-sans leading-relaxed line-clamp-4"
      />
    </div>
  );
};
