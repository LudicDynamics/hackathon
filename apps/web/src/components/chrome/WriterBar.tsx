/**
 * WriterBar.tsx — the free-input channel to the writer (prototype #writerBar,
 * L532). Enter submits, then the field clears; Shift+Enter is left to the
 * browser (single-line input ignores it anyway).
 *
 * `onSend` is only called with non-empty, trimmed text. The parent owns
 * `disabled` (world frozen / request in flight), so this stays presentational
 * — except for the writer's own busy phase: while the writer is mid-turn the
 * field locks and the placeholder explains why, instead of silently queueing
 * input the writer will never read (docs/perform/01 §6.4).
 */
import React, { useState } from 'react';
import { useWriterPhase } from '../../lib/writer-state.js';

export interface WriterBarProps {
  /** Receives the trimmed prompt text. Called after the field is cleared. */
  onSend: (text: string) => void;
  /** Locks the bar (no input, no submit) when true. */
  disabled?: boolean;
  placeholder?: string;
  /** Copy swapped in while the writer is mid-turn. */
  writingPlaceholder?: string;
  sendLabel?: string;
}

export const WriterBar: React.FC<WriterBarProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Ask the writer…',
  writingPlaceholder = 'The writer is writing…',
  sendLabel = 'Send',
}) => {
  const [text, setText] = useState('');
  const writing = useWriterPhase() === 'writing';
  const locked = disabled || writing;

  const submit = (): void => {
    const trimmed = text.trim();
    if (!trimmed || locked) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div
      className="writer-bar"
      data-disabled={disabled ? 'true' : undefined}
      data-writing={writing ? 'true' : undefined}
    >
      <input
        className={writing ? 'writer-bar__input busy' : 'writer-bar__input'}
        type="text"
        value={text}
        placeholder={writing ? writingPlaceholder : placeholder}
        autoComplete="off"
        disabled={locked}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button
        className="writer-bar__send"
        type="button"
        disabled={locked}
        onClick={submit}
      >
        {sendLabel}
      </button>
    </div>
  );
};
