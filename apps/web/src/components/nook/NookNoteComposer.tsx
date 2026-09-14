import React, { useState } from 'react';

export interface NookNoteComposerProps {
  characterId: string;
  onCreated?: () => void;
  disabled?: boolean;
  lockMessage?: string;
}
function clientRefOf(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // Fall through to a local, collision-resistant enough reference.
  }
  return `nook-note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const NookNoteComposer: React.FC<NookNoteComposerProps> = ({ characterId, onCreated, disabled = false, lockMessage }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || busy || !title.trim() || !body.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/nook-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, title: title.trim(), body: body.trim(), clientRef: clientRefOf() }),
      });
      const result = (await response.json().catch(() => ({}))) as { path?: string; details?: { path?: string }; error?: string };
      const path = result.path ?? result.details?.path;
      if (!response.ok || !path) {
        throw new Error(result.error || `Could not leave this note (${response.status})`);
      }
      setTitle('');
      setBody('');
      setMessage('Note left in this nook.');
      onCreated?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not leave this note.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="absolute bottom-4 right-4 z-20 w-72 rounded-xl border border-ink/10 bg-paper-card/95 p-3 shadow-soft backdrop-blur-md" aria-label="Leave a note">
      <input
        value={title}
        onChange={event => setTitle(event.target.value)}
        placeholder="Title"
        aria-label="Note title"
        disabled={disabled || busy}
        className="mb-2 w-full rounded-lg border border-ink/10 bg-paper-wall/60 px-2 py-1.5 text-xs text-ink outline-none"
      />
      <textarea
        value={body}
        onChange={event => setBody(event.target.value)}
        placeholder="Write something for this nook…"
        aria-label="Note body"
        disabled={disabled || busy}
        rows={3}
        className="mb-2 w-full resize-none rounded-lg border border-ink/10 bg-paper-wall/60 px-2 py-1.5 text-xs text-ink outline-none"
      />
      <button type="submit" disabled={disabled || busy || !title.trim() || !body.trim()} className="rounded-lg bg-ink px-3 py-1.5 text-xs text-white disabled:opacity-40">
        {busy ? 'Leaving note…' : 'Leave note'}
      </button>
      {disabled && <div role="status" className="mt-2 text-[10px] text-ink/60">{lockMessage || 'Notes are unavailable while the world is busy.'}</div>}
      {message && <div role="status" className="mt-2 text-[10px] text-ink/70">{message}</div>}
    </form>
  );
};
