import React, { useState, useEffect } from 'react';
import { ChalkCard } from '../narrative/ChalkCard.js';
import { MarkdownText, plainExcerpt, stripLeadingTitle, leadingTitleOf } from '../../lib/md.js';
import { playFoley } from '../../lib/audio.js';

interface CardRendererProps {
  item: {
    path: string;
    filename: string;
    frontmatter: Record<string, any> | null;
    body: string;
  };
  /** Ordinal of this gate among the layer's gates (Main computes it). */
  index?: number;
  onSelectChoice?: (path: string, choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (targetLayer: string) => void;
  onOpenCharacterModal?: (charId: string) => void;
  onItemDropOnTarget?: (draggedItemPath: string, targetPath: string) => void;
  onTakeItem?: (path: string) => void;
}

/**
 * Hand-drawn scene icon (prototype `ICONS.inn`, canvas-stack-mingyue.html L681).
 * Inline SVG, ink stroke, deliberately uneven paths.
 */
const GateIcon: React.FC = () => (
  <svg
    viewBox="0 0 72 72"
    width={72}
    height={72}
    fill="none"
    stroke="#2B2117"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 58 L58 58" />
    <path d="M20 58 L20 34 Q36 20 52 34 L52 58" />
    <path d="M28 58 L28 42 h16 v16" />
    <path d="M36 6 l0 8 M32 10 h8" />
    <circle cx="36" cy="14" r="2.4" />
  </svg>
);

/** Hand-drawn ordinal seal (prototype `numCircle`, L692-695). */
const GateNum: React.FC<{ n: number | string }> = ({ n }) => (
  <svg className="gate__num" viewBox="0 0 34 34">
    <ellipse
      cx="17"
      cy="17"
      rx="14.6"
      ry="13.2"
      fill="none"
      stroke="#A8362B"
      strokeWidth={1.8}
      transform="rotate(-6 17 17)"
      strokeDasharray="86 4"
    />
    <text
      x="17"
      y="22"
      textAnchor="middle"
      fontSize="15"
      fill="#A8362B"
      fontFamily="KaiTi, STKaiti, serif"
    >
      {n}
    </text>
  </svg>
);

/** Push pin (prototype `pinSVG`, L696-698). */
const GatePin: React.FC = () => (
  <svg className="gate__pin" width="18" height="24" viewBox="0 0 18 24">
    <circle cx="9" cy="7" r="6.5" fill="#A8362B" />
    <path d="M9 12 L9 22" stroke="#5F5142" strokeWidth={1.6} />
    <circle cx="9" cy="7" r="2.4" fill="#FFFEF6" />
  </svg>
);

export const CardRenderer: React.FC<CardRendererProps> = ({
  item,
  index = 1,
  onSelectChoice,
  onDiceRolled,
  onEnterGate,
  onOpenCharacterModal,
  onItemDropOnTarget,
  onTakeItem,
}) => {
  const { frontmatter, body, filename, path } = item;
  const [letterOpen, setLetterOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isItemDragging, setIsItemDragging] = useState(false);
  const [isUnlockedEffect, setIsUnlockedEffect] = useState(false);

  useEffect(() => {
    const onDragStart = () => setIsItemDragging(true);
    const onDragEnd = () => {
      setIsItemDragging(false);
      setIsDragOver(false);
    };
    window.addEventListener('airp:item-drag-start', onDragStart);
    window.addEventListener('airp:item-drag-end', onDragEnd);
    return () => {
      window.removeEventListener('airp:item-drag-start', onDragStart);
      window.removeEventListener('airp:item-drag-end', onDragEnd);
    };
  }, []);

  const handleTargetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const draggedPath = e.dataTransfer.getData('text/plain');
    if (draggedPath) {
      playFoley('unlock');
      setIsUnlockedEffect(true);
      setTimeout(() => setIsUnlockedEffect(false), 800);
      onItemDropOnTarget?.(draggedPath, path);
    }
  };

  const puzzleClasses = `${isItemDragging ? 'puzzle-target-ready' : ''} ${isDragOver ? 'puzzle-target-hover' : ''} ${isUnlockedEffect ? 'puzzle-unlock-burst' : ''}`.trim();

  // 1. Chalk Card — ink on the canvas (bare by default).
  if (frontmatter?.type === 'chalk') {
    return (
      <ChalkCard
        item={item}
        onSelectChoice={(choice) => onSelectChoice?.(path, choice)}
        onDiceRolled={onDiceRolled}
      />
    );
  }

  // 2. Gate Card (sub-scene portal) — a sub-directory's README, the door that
  //    walks into that scene. The current layer's own README is never a card
  //    (see cardsOfLayer), so every gate here genuinely navigates somewhere.
  if (frontmatter?.type === 'gate' || filename === 'README.md') {
    const isStub = frontmatter?.stub || false;
    // Title: frontmatter title, else the scene name, else the parent directory
    // name — never the literal filename "README".
    const title =
      frontmatter?.title ||
      frontmatter?.name ||
      (path.includes('/')
        ? path.slice(0, -'/README.md'.length).split('/').pop()
        : filename.replace('.md', ''));
    // Ordinal: explicit frontmatter order/n wins, else the layer-derived gate
    // index. Formatted to two digits ("01") like the prototype's seal — numeric
    // orders pad, but a non-numeric label (e.g. "A") passes through untouched.
    const rawOrder = frontmatter?.order ?? frontmatter?.n;
    const orderNum = rawOrder != null && rawOrder !== '' ? rawOrder : index;
    const order = /^\d+$/.test(String(orderNum))
      ? String(orderNum).padStart(2, '0')
      : orderNum;
    const meta = isStub ? 'UNWRITTEN · walk in, and it will be written →' : 'SCENE · ENTRANCE';
    // The card face shows a clean one-line excerpt; the raw README markdown
    // (# heading, line breaks) stays in the hover sheet. Never spill source.
    const excerpt = plainExcerpt(body);
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
        onDrop={handleTargetDrop}
        className={`gate${isStub ? ' gate--stub' : ''} ${puzzleClasses}`}
      >
        <GateNum n={order} />
        <GatePin />
        <div className="gate__cover">
          <GateIcon />
        </div>
        {/* The card face keeps a two-line teaser; the full README detail lives
            in a floating sheet on hover (never spills past the card). */}
        <div className="gate__body">
          <div className="gate__title">{title}</div>
          <div className="gate__desc">{excerpt}</div>
          <div className="gate__meta">{meta}</div>
        </div>
        {excerpt !== '' && (
          <div className="gate__detail">
            <MarkdownText text={stripLeadingTitle(body)} />
          </div>
        )}
      </div>
    );
  }

  // 3. Letter component — a sealed sheet; click opens the reading overlay.
  if (frontmatter?.type === 'component' && frontmatter?.component === 'letter') {
    return (
      <>
        <div
          onClick={() => setLetterOpen(true)}
          className={`letter ${puzzleClasses}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleTargetDrop}
        >
          <div className="letter__head">
            <span className="letter__seal" />
            {frontmatter.title || 'Letter'}
          </div>
          <div className="letter__preview">
            {/* frontmatter.preview is authored copy; the body fallback is raw
                markdown, so flatten it — a card face never shows source. */}
            {frontmatter.preview || plainExcerpt(body)}
          </div>
          <div className="letter__meta">
            <span>{frontmatter.sign || 'Click to open and read'}</span>
          </div>
        </div>

        {letterOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(41, 40, 32, 0.35)', backdropFilter: 'blur(2px)' }}
            onClick={() => setLetterOpen(false)}
          >
            <div
              className="w-full max-w-lg p-8 text-ink relative"
              style={{
                background: 'var(--cream)',
                boxShadow: '0 20px 70px rgba(41,40,32,0.25)',
                transform: 'rotate(-1deg)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-serif text-2xl mb-4">{frontmatter.title}</h3>
              <div className="font-serif text-base leading-loose whitespace-pre-line mb-6">
                {frontmatter.body || body}
              </div>
              {frontmatter.sign && (
                <div className="text-right font-serif text-sm text-ink/60">
                  —— {frontmatter.sign}
                </div>
              )}
              <div className="mt-6 text-center">
                <button
                  onClick={() => setLetterOpen(false)}
                  className="px-6 py-2 text-xs font-mono transition-all border border-ink/20 hover:bg-ink hover:text-cream"
                >
                  Fold &amp; Put Away (Esc)
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  const noteTitle =
    frontmatter?.title || leadingTitleOf(body) || filename.replace('.md', '');

  // 4. Note / clue (default) — a sticky sheet, no white rounded card.
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleTargetDrop}
      className={`note ${puzzleClasses}`}
    >
      <span className="note__clip" />
      <div className="note__title">{noteTitle}</div>
      <MarkdownText text={stripLeadingTitle(body)} className="note__body" />
      {frontmatter?.portable === true && (
        <button
          type="button"
          data-no-drag
          className="note__take"
          onClick={() => onTakeItem?.(path)}
        >
          {typeof frontmatter.take_label === 'string' ? frontmatter.take_label : 'Take'}
        </button>
      )}
    </div>
  );
};
