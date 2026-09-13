import { useEffect, useRef, useState } from 'react';
import { usePlayHintsEnabled } from '../lib/play-hints.js';
import { useLocale } from '../lib/i18n.js';
import { AgentActivity } from './AgentActivity.js';

/** One ephemeral receipt per settled turn; never render reasoning or tool arguments. */
export function WriterResult({ worldKey, onContinue }: { worldKey?: string; onContinue?: () => void }) {
  const hintsEnabled = usePlayHintsEnabled();
  const { t } = useLocale();
  const [result, setResult] = useState<{ text: string; id: number } | null>(null);
  const [progress, setProgress] = useState('');
  const [canContinue, setCanContinue] = useState(false);
  const lastReply = useRef('');
  const active = useRef(false);
  useEffect(() => {
    setResult(null); setProgress(''); setCanContinue(false); lastReply.current = ''; active.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const receive = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (frame.source !== 'writer') return;
      if (frame.type === 'agent_progress') setProgress(frame.busy && typeof frame.stage === 'string' ? frame.stage : '');
      if (['writer_delta', 'chalk_writing', 'tool_start', 'writer_message'].includes(frame.type) || (frame.type === 'agent_progress' && frame.busy)) {
        if (!active.current) { active.current = true; setCanContinue(false); lastReply.current = ''; clearTimeout(timer); setResult(null); }
      }
      if (frame.type === 'writer_message' && typeof frame.text === 'string') lastReply.current = frame.text;
      if (['error', 'turn_aborted'].includes(frame.type)) { active.current = false; lastReply.current = ''; setProgress(''); setCanContinue(false); setResult(null); clearTimeout(timer); }
      if (frame.type === 'writer_idle' && active.current) {
        active.current = false;
        setProgress(''); setCanContinue(true);
        const text = lastReply.current.replace(/\s+/g, ' ').trim();
        setResult({ text: text || 'Your action has been processed.', id: Date.now() });
        lastReply.current = '';
        clearTimeout(timer); timer = setTimeout(() => setResult(null), 7000);
      }
    };
    window.addEventListener('airp:agent-frame', receive);
    return () => { clearTimeout(timer); window.removeEventListener('airp:agent-frame', receive); };
  }, [worldKey]);
  return <>
    {progress ? <div className="writer-result writer-progress" role="status">{progress}</div> : result ? <div key={result.id} className="writer-result" role="status">{result.text}</div> : null}
    {hintsEnabled && onContinue && <button type="button" className="writer-continue" disabled={!!progress} onClick={onContinue}>{t('Continue · next-step hint →')}</button>}
    <AgentActivity worldKey={worldKey} />
  </>;
}
