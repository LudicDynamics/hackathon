import { useEffect, useRef, useState } from 'react';
import { useWriterState } from '../lib/writer-state.js';

/** One ephemeral receipt per settled turn; never render reasoning or tool arguments. */
export function WriterResult({ worldKey }: { worldKey?: string }) {
  const writer = useWriterState();
  // The snapshot owns the receipt text. Local state only controls its
  // seven-second visibility window; it never copies or caches writer content.
  const [visibleSeq, setVisibleSeq] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seenCompletion = useRef(0);

  useEffect(() => {
    setVisibleSeq(null);
    seenCompletion.current = writer.completionSeq;
    clearTimeout(timer.current);
    timer.current = undefined;
  }, [worldKey]);

  useEffect(() => {
    if (writer.error || (writer.phase === 'idle' && writer.stage === null)) {
      setVisibleSeq(null);
      seenCompletion.current = writer.completionSeq;
      return;
    }
    if (writer.phase !== 'idle' || writer.completionSeq === 0 || writer.completionSeq === seenCompletion.current) return;
    seenCompletion.current = writer.completionSeq;
    setVisibleSeq(writer.completionSeq);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisibleSeq(null), 7000);
  }, [writer.completionSeq, writer.error, writer.phase, writer.stage]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  if (visibleSeq === null || visibleSeq !== writer.completionSeq) return null;
  const text = (writer.lastMessage ?? '').replace(/\s+/g, ' ').trim() || 'Your action has been processed.';
  return <div key={visibleSeq} className="writer-result" role="status">{text}</div>;
}
