import React, { useState } from 'react';
import { Dices, CheckCircle2, AlertCircle } from 'lucide-react';
import { actionKey } from '../../lib/action-feedback.js';
/** Shared ceremony timings. DiceCeremony is the only renderer; these remain a
 * stable import seam for the two components. */
export const ROLL_MS = 1200;
export const SETTLE_MS = 1300;
export const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
import { ingestPlayerRoll, parsePlayerDiceResponse, type DiceCeremonyInput } from '../../lib/dice-ceremony.js';

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
  rollDice: {
    desc: string;
    expect: string;
    result?: number;
    passed?: boolean;
  };
  /** Retained for the existing card projection; called after an accepted verdict. */
  onRollComplete?: (result: number, passed: boolean) => void;
}

interface RolledSummary {
  result: number;
  passed: boolean;
  crit?: boolean;
  fumble?: boolean;
}

function playerRequestKey(path: string): string {
  return actionKey('dice', path);
}

/** The card is a trigger and result summary; DiceCeremony owns all animation. */
export const DiceRoller: React.FC<DiceRollerProps> = ({ filePath, rollDice, onRollComplete }) => {
  const [rolled, setRolled] = useState<RolledSummary | null>(() => {
    const r = rollDice.result;
    const p = rollDice.passed;
    return r !== undefined && p !== undefined ? { result: r, passed: p } : null;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roll = async () => {
    if (busy || rolled) return;
    setError(null);
    if (filePath === '') {
      setError('Could not roll: this card has no world-relative path.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/dice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
      const raw: unknown = await res.json().catch(() => null);
      const rawObj = raw !== null && typeof raw === 'object' ? raw as Record<string, unknown> : null;
      // The action envelope is authoritative: a 2xx response without ok:true is
      // not a domain success and must never enter the ceremony.
      if (!res.ok || rawObj?.ok !== true) {
        const code = typeof rawObj?.code === 'string' ? rawObj.code : `HTTP ${res.status}`;
        const message = typeof rawObj?.error === 'string' ? rawObj.error : code;
        throw new Error(message);
      }
      const details = parsePlayerDiceResponse(raw, res.ok);
      if (!details) throw new Error(`/api/dice → ${res.status} (missing authoritative roll details)`);
      // Domain facts are parsed before the sole ceremony is staged. A duplicate
      // request is not replayed and is not reported as a fresh roll.
      const input: DiceCeremonyInput | null = ingestPlayerRoll(details, playerRequestKey(filePath));
      if (!input) throw new Error('This roll result was already presented or was incomplete.');
      setRolled({ result: input.result, passed: input.passed, crit: input.crit, fumble: input.fumble });
      onRollComplete?.(input.result, input.passed);
    } catch (err) {
      setError(`Could not roll: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const badge = (pass: boolean) =>
    pass ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5" /> Check Passed
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3.5 h-3.5" /> Check Failed
      </span>
    );

  return (
    <div className="mt-4 p-4 rounded-2xl bg-paper-wall/60 border border-ink/10 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Dices className="w-5 h-5 text-rust" />
          <span className="text-sm font-semibold tracking-wide text-ink">{rollDice.desc}</span>
        </div>
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-ink/5 text-ink/70">
          Requires: {rollDice.expect}
        </span>
      </div>

      {rolled ? (
        <div className="flex items-center gap-4">
          <div className="dice-cube dice-cube-compact" aria-hidden="true"><Dices className="w-7 h-7" /></div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold text-ink">{rolled.result}</span>
            {badge(rolled.passed)}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void roll()}
            disabled={busy}
            className="self-start px-4 py-1.5 rounded-full bg-rust hover:bg-rust-light text-white text-xs font-medium tracking-wide shadow-sm transition-all disabled:opacity-60"
          >
            {busy ? 'Resolving…' : 'Roll the Dice'}
          </button>
          <span className="text-xs text-ink/50">The result will be shown in the dice ceremony.</span>
          {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
        </div>
      )}
    </div>
  );
};
