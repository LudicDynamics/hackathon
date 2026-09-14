import React from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { useLocale } from '../../lib/i18n.js';
import { useVoiceInput } from '../../lib/voice-input.js';

/**
 * Microphone toggle for the writer bar and the character dialogue. One press
 * records, the next stops; the transcript goes to `onText` as draft text only.
 */
export function VoiceInputButton({
  onText,
  disabled = false,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const { locale, t } = useLocale();
  const { state, error, toggle } = useVoiceInput({ locale, onText });
  const label = state === 'recording'
    ? t('Stop recording')
    : state === 'transcribing'
      ? t('Transcribing…')
      : t('Voice input');
  const errorText = error === 'mic_denied'
    ? t('Microphone access was refused. Allow it, then try again.')
    : error === 'mic_unsupported'
      ? t('This browser cannot record from a microphone.')
      : error === 'unavailable'
        ? t('Voice input is not configured on this server.')
        : error === 'failed'
          ? t('Could not transcribe the recording. Please try again.')
          : '';

  return (
    <>
      <button
        type="button"
        className="voice-input-button"
        data-state={state}
        aria-pressed={state === 'recording'}
        aria-label={label}
        title={label}
        // A recording in progress can always be stopped, even if the host locks.
        disabled={state === 'transcribing' || (disabled && state === 'idle')}
        onClick={toggle}
      >
        {state === 'recording'
          ? <Square size={13} aria-hidden="true" />
          : state === 'transcribing'
            ? <Loader2 size={15} className="voice-input-button__spin" aria-hidden="true" />
            : <Mic size={15} aria-hidden="true" />}
      </button>
      {errorText && <span className="voice-input-error" role="alert">{errorText}</span>}
    </>
  );
}
