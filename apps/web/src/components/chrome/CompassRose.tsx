/**
 * CompassRose.tsx — the hand-drawn compass that anchors a scene (prototype
 * COMPASS, canvas-stack-mingyue.html L685-691). Pure decoration: the caller
 * positions it via `className`, the SVG keeps the prototype's 120x120 geometry
 * so the rose reads the same at any corner.
 *
 * The 北 glyph is kept verbatim from the prototype: it is part of the rose's
 * drawn identity, not UI copy.
 */
import React from 'react';

export interface CompassRoseProps {
  /** Positioning/size hook for the caller (e.g. 'absolute right-8 top-8'). */
  className?: string;
}

export const CompassRose: React.FC<CompassRoseProps> = ({ className }) => (
  <svg
    className={['compass-rose', className].filter(Boolean).join(' ')}
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    stroke="var(--muted)"
    strokeWidth="1.4"
    aria-hidden="true"
  >
    <circle cx="60" cy="60" r="46" />
    <circle cx="60" cy="60" r="34" strokeDasharray="2 6" />
    <path d="M60 22 L66 56 L60 62 L54 56 Z" fill="var(--muted)" stroke="none" />
    <path
      d="M60 98 L66 64 L60 58 L54 64 Z"
      fill="var(--muted)"
      stroke="none"
      opacity=".7"
    />
    <path d="M60 8 v10 M60 102 v10 M8 60 h10 M102 60 h10" />
    <text
      x="60"
      y="16"
      textAnchor="middle"
      fontSize="11"
      fill="var(--muted)"
      fontFamily="serif"
    >
      北
    </text>
  </svg>
);
