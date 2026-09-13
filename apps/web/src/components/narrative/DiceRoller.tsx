import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dices } from 'lucide-react';
import { unlock, playFoley } from '../../lib/audio.js';
import { D10Stage } from '../performance/D10Stage.js';
import { useLocale } from '../../lib/i18n.js';

export const CHARGE_MS = 1200;
export const ROLL_MS = 1200;
export const SETTLE_MS = 4000;
export const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

interface DiceVerdict {
  dice: string;
  rolls: number[];
  result: number;
  passed: boolean;
  crit: boolean;
  fumble: boolean;
  outcomeGrade?: string;
}
export function parseDiceVerdict(raw: unknown): DiceVerdict | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.result !== 'number' || !Number.isFinite(o.result) || typeof o.passed !== 'boolean'
    || typeof o.dice !== 'string' || !Array.isArray(o.rolls) || !o.rolls.length
    || !o.rolls.every(r => typeof r === 'number' && Number.isFinite(r))) return null;
  return { dice: o.dice, rolls: o.rolls, result: o.result, passed: o.passed, crit: o.crit === true, fumble: o.fumble === true, ...(typeof o.outcomeGrade === 'string' ? { outcomeGrade: o.outcomeGrade } : {}) };
}
interface DiceRollerProps {
  filePath: string;
  rollDice: { type?: string; desc: string; expect: string; result?: number; passed?: boolean };
  onRollComplete?: (result: number, passed: boolean) => void;
}

/** The HTTP verdict is authoritative. A portal keeps the throw outside transformed cards. */
export const DiceRoller: React.FC<DiceRollerProps> = ({ filePath, rollDice, onRollComplete }) => {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<DiceVerdict | null>(null);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const alive = useRef(true);
  const completed = useRef(false);
  const callback = useRef(onRollComplete); callback.current = onRollComplete;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const result = verdict?.result ?? rollDice.result;
  const passed = verdict?.passed ?? rollDice.passed;
  const grade = verdict?.outcomeGrade ?? (verdict?.crit ? 'great-success' : passed ? 'success' : 'failure');
  const resultLabel = grade === 'great-success' ? (locale === 'ja' ? '大成功' : locale === 'zh-CN' ? '大成功' : 'Great success') : passed ? (locale === 'ja' ? '成功' : locale === 'zh-CN' ? '成功' : 'Success') : (locale === 'ja' ? '不成功・次の手掛かりへ' : locale === 'zh-CN' ? '未成功 · 还有下一步' : 'Setback · a way forward remains');
  const roll = async () => {
    if (running.current || result !== undefined) return;
    running.current = true; completed.current = false;
    setError(''); setSettled(false); setOpen(true);
    void unlock(); playFoley('dice-roll');
    try {
      if (!filePath) throw new Error('This card has no world-relative path.');
      const res = await fetch('/api/dice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath }) });
      const raw = await res.json();
      if (!res.ok || raw?.ok === false) throw new Error(raw?.error || `/api/dice → ${res.status}`);
      const value = parseDiceVerdict(raw);
      if (!value) throw new Error('The dice response was not the expected shape.');
      if (alive.current) setVerdict(value);
    } catch (reason) {
      if (alive.current) { setOpen(false); setError(`Could not roll: ${reason instanceof Error ? reason.message : String(reason)}`); }
    } finally { running.current = false; }
  };
  const land = () => {
    if (!verdict || completed.current) return;
    completed.current = true; setSettled(true);
    if (grade === 'great-success') playFoley('crit-chime');
    else if (verdict.passed) playFoley('unlock');
    else playFoley('page-turn');
    callback.current?.(verdict.result, verdict.passed);
  };
  return <div className="mt-4 p-4 rounded-2xl bg-paper-wall/60 border border-ink/10">
    <div className="flex items-center gap-2"><Dices size={18} /><strong>{rollDice.desc}</strong></div>
    <small>{rollDice.type} · Requires: {rollDice.expect}</small>
    {result !== undefined && passed !== undefined ? <p role="status"><strong>{result}</strong> · {passed ? 'Check Passed' : 'Check Failed'}</p>
      : <button type="button" className="block mt-3 px-4 py-2 rounded-full bg-rust text-white" onClick={() => void roll()}>Roll the Dice</button>}
    {error && <p role="alert">{error}</p>}
    {open && createPortal(<div className="d10-overlay" data-no-drag
      onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false); }}>
      <div className={`d10-dialog ${settled ? `dice-landed dice-landed--${grade}` : ''}`} role="dialog" aria-modal="true" aria-label={rollDice.desc}>
        <strong>{rollDice.desc}</strong>
        <D10Stage integrated dice={verdict?.dice ?? rollDice.type ?? ''} rolls={verdict?.rolls} settled={settled} onLanded={land} />
        {!settled && <p role="status">{verdict ? 'Rolling…' : 'Waiting for the roll…'}</p>}
        {settled && verdict && <><output className="dice-result-number">{verdict.result}</output><p role="status">{resultLabel} · {rollDice.expect}</p></>}
        <button type="button" autoFocus onClick={() => setOpen(false)}>{settled ? 'Done' : 'Close'}</button>
      </div>
    </div>, document.body)}
  </div>;
};
