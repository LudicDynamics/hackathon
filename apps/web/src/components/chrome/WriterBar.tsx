/**
 * WriterBar.tsx — the free-input channel to the writer (prototype #writerBar,
 * L532). Enter submits, then the field clears; Shift+Enter is left to the
 * browser (single-line input ignores it anyway).
 *
 * `onSend` is only called with non-empty, trimmed text. The parent owns
 * `disabled` (world frozen / request in flight), so this stays presentational.
 */
import React, { useState } from 'react';

export interface WriterBarProps {
  /** Receives the trimmed prompt text. Called after the field is cleared. */
  onSend: (text: string) => void;
  /** Locks the bar (no input, no submit) when true. */
  disabled?: boolean;
  placeholder?: string;
}

export const WriterBar: React.FC<WriterBarProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Ask the writer…',
}) => {
  const [text, setText] = useState('');

  const submit = (): void => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="writer-bar" data-disabled={disabled ? 'true' : undefined}>
      <input
        className="writer-bar__input"
        type="text"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
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
        disabled={disabled}
        onClick={submit}
      >
        Send
      </button>
    </div>
  );
};
