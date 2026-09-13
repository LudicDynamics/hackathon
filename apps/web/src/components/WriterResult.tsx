import { useEffect, useRef, useState } from 'react';

/** One ephemeral receipt per settled turn; never render reasoning or tool arguments. */
export function WriterResult({ worldKey }: { worldKey?: string }) {
  const [result, setResult] = useState<{ text: string; id: number } | null>(null);
  const lastReply = useRef('');
  const active = useRef(false);
  useEffect(() => {
    setResult(null); lastReply.current = ''; active.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const receive = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (frame.source !== 'writer') return;
      if (['writer_delta', 'chalk_writing', 'tool_start', 'writer_message'].includes(frame.type) || (frame.type === 'agent_progress' && frame.busy)) {
        if (!active.current) { active.current = true; lastReply.current = ''; clearTimeout(timer); setResult(null); }
      }
      if (frame.type === 'writer_message' && typeof frame.text === 'string') lastReply.current = frame.text;
      if (['error', 'turn_aborted'].includes(frame.type)) { active.current = false; lastReply.current = ''; setResult(null); clearTimeout(timer); }
      if (frame.type === 'writer_idle' && active.current) {
        active.current = false;
        const text = lastReply.current.replace(/\s+/g, ' ').trim();
        setResult({ text: text || 'Your action has been processed.', id: Date.now() });
        lastReply.current = '';
        clearTimeout(timer); timer = setTimeout(() => setResult(null), 7000);
      }
    };
    window.addEventListener('airp:agent-frame', receive);
    return () => { clearTimeout(timer); window.removeEventListener('airp:agent-frame', receive); };
  }, [worldKey]);
  return result ? <div key={result.id} className="writer-result" role="status">{result.text}</div> : null;
}
