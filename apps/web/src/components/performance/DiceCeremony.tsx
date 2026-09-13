/**
 * DiceCeremony.tsx — the agent-driven dice ceremony (`dice_result`, docs/perform/02).
 *
 * The player's own path (DiceRoller.tsx) charges → tumbles → settles. The frame
 * path has no hand, so it skips the charge phase and replays tumble → settle
 * with the same timings, face styling, sounds and result layout (docs/perform/02
 * §3.3) — one visual language, two entry points. It changes no state, calls no
 * camera, and posts nothing (§4, §6.4).
 */
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { playFoley, playStinger } from '../../lib/audio.js';
import { ROLL_MS, SETTLE_MS } from '../narrative/DiceRoller.js';
import {
  toDiceCeremonyInput,
  rollingFace,
  type DiceCeremonyInput,
  type DiceFrameVerdict,
} from '../../lib/dice-ceremony.js';
import { diceStageDisplay } from '../../lib/d10-display.js';
import { D10Stage } from './D10Stage.js';
import { useStill } from '../../lib/motion.js';

/** Reduced motion still rolls, just briefly: less movement, same information. */
const STILL_ROLL_MS = 180;
/** Face swap cadence while tumbling. */
const FACE_SPIN_MS = 90;
/** Highlight duration once settled. */
const HIGHLIGHT_MS = 800;
interface DiceCeremonyProps {
  /** Canonical input, or the legacy App verdict alias during the mount migration. */
  verdict: DiceCeremonyInput | DiceFrameVerdict;
  /** End the ceremony (played out, dismissed, or interrupted by a layer switch). */
  onDone: () => void;
}

/** The frame path has no charge phase (docs/perform/02 §3.3). */
type CeremonyPhase = 'rolling' | 'settled';

export const DiceCeremony: React.FC<DiceCeremonyProps> = ({ verdict: rawVerdict, onDone }) => {
  const input: DiceCeremonyInput | null =
    'requestKey' in rawVerdict
      ? rawVerdict
      : toDiceCeremonyInput(
          rawVerdict,
          rawVerdict.source === 'character' ? 'character-frame' : 'writer-frame',
        );
  const stageDisplay = input ? diceStageDisplay(input.dice, input.rolls) : null;
  const still = useStill();
  const [phase, setPhase] = useState<CeremonyPhase>('rolling');
  const [tick, setTick] = useState(0);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!input) {
      onDoneRef.current();
      return;
    }
    if (phase !== 'rolling') return;
    playFoley('dice-roll');
    const spin = still ? null : window.setInterval(() => setTick((t) => t + 1), FACE_SPIN_MS);
    const timer = window.setTimeout(() => setPhase('settled'), still ? STILL_ROLL_MS : ROLL_MS);
    return () => {
      if (spin !== null) window.clearInterval(spin);
      window.clearTimeout(timer);
    };
  }, [phase, still, input]);

  useEffect(() => {
    if (!input || phase !== 'settled') return;
    if (input.crit) playStinger('smile');
    else if (input.fumble) playStinger('shock');

    const el = document.querySelector<HTMLElement>(
      `.object[data-path="${CSS.escape(input.path)}"]`
    );
    el?.classList.add('dice-ceremony-highlight');
    const hi = window.setTimeout(() => el?.classList.remove('dice-ceremony-highlight'), HIGHLIGHT_MS);
    const done = window.setTimeout(() => onDoneRef.current(), SETTLE_MS);
    return () => {
      window.clearTimeout(hi);
      window.clearTimeout(done);
      el?.classList.remove('dice-ceremony-highlight');
    };
  }, [phase, input]);

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

  if (!input) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(41,40,32,0.55)] backdrop-blur-sm flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Dice result ceremony"
    >
      {input.fumble && <div className="fumble-crack" />}
      <div className={`dice-stage ${input.fumble && !still ? 'dice-shake' : ''}`}>
        {input.crit && <div className="crit-glow" />}
        {stageDisplay ? (
          <D10Stage dice={input.dice} rolls={input.rolls} settled={phase === 'settled'} integrated />
        ) : (
          <div className="dice-stage__faces">
            {input.rolls.map((value, i) => (
              <div key={i} className="dice-face-tile">
                {phase === 'rolling' ? rollingFace(i, tick, value) : value}
              </div>
            ))}
          </div>
        )}
        <div className="dice-stage__caption">
          {input.desc !== '' && <span className="font-semibold">{input.desc}</span>}
          {input.expect !== '' && (
            <span className="font-mono text-xs">Requires: {input.expect}</span>
          )}
          {(input.name !== '' || input.dice !== '') && (
            <span className="font-mono text-xs text-ink/50">
              {input.name}
              {input.name !== '' && input.dice !== '' ? ' · ' : ''}
              {input.dice}
            </span>
          )}
        </div>
        {phase === 'rolling' && (
          <span className="font-mono text-xs text-ink/60 animate-pulse tracking-widest uppercase">
            The dice of fate are spinning...
          </span>
        )}
        {phase === 'settled' && (
          <div className="flex flex-col items-center gap-4">
            <div
              className={`dice-result-number ${
                input.crit
                  ? 'dice-result-crit'
                  : input.fumble
                    ? 'dice-result-fumble'
                    : 'text-ink'
              }`}
            >
              {input.result}
            </div>
            {badge(input.passed)}
            <button
              onClick={onDone}
              className="px-5 py-2 rounded-full bg-ink text-white text-xs font-semibold tracking-wide shadow-sm hover:opacity-80 transition-opacity"
            >
              DONE
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
