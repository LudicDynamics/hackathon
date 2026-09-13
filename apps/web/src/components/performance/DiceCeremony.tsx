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
import { rollingFace, type DiceFrameVerdict } from '../../lib/dice-ceremony.js';
import { useStill } from '../../lib/motion.js';

/** Reduced motion still rolls, just briefly: less movement, same information. */
const STILL_ROLL_MS = 180;
/** Face swap cadence while tumbling (docs/perform/02 §8). */
const FACE_SPIN_MS = 90;
/** Highlight duration once settled — one glance back at the judged card. */
const HIGHLIGHT_MS = 800;

interface DiceCeremonyProps {
  /** Guarded / de-duped / layer-filtered verdict (lib/dice-ceremony.ts). */
  verdict: DiceFrameVerdict;
  /** End the ceremony (played out, dismissed, or interrupted by a layer switch). */
  onDone: () => void;
}

/** The frame path has no charge phase (docs/perform/02 §3.3). */
type CeremonyPhase = 'rolling' | 'settled';

export const DiceCeremony: React.FC<DiceCeremonyProps> = ({ verdict, onDone }) => {
  const still = useStill();
  const [phase, setPhase] = useState<CeremonyPhase>('rolling');
  const [tick, setTick] = useState(0);

  // `onDone` identity is not part of the effect contract: holding it in a ref
  // keeps the settle effect from re-running (and re-firing the stinger) on
  // every parent render.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Tumble: roll foley, face spin, then hand over to the settled phase.
  useEffect(() => {
    if (phase !== 'rolling') return;
    playFoley('dice-roll');
    const spin = still ? null : window.setInterval(() => setTick((t) => t + 1), FACE_SPIN_MS);
    const timer = window.setTimeout(() => setPhase('settled'), still ? STILL_ROLL_MS : ROLL_MS);
    return () => {
      if (spin !== null) window.clearInterval(spin);
      window.clearTimeout(timer);
    };
  }, [phase, still]);

  // Settle: emotion stinger, one highlight on the judged card, then close.
  useEffect(() => {
    if (phase !== 'settled') return;
    if (verdict.crit) playStinger('smile');
    else if (verdict.fumble) playStinger('shock');

    // The judged card may be absent (layer refresh still in flight, or the card
    // is elsewhere): the ceremony must not wait on data, so a miss is silent.
    const el = document.querySelector<HTMLElement>(
      `.object[data-path="${CSS.escape(verdict.path)}"]`
    );
    el?.classList.add('dice-ceremony-highlight');
    const hi = window.setTimeout(() => el?.classList.remove('dice-ceremony-highlight'), HIGHLIGHT_MS);
    const done = window.setTimeout(() => onDoneRef.current(), SETTLE_MS);
    return () => {
      window.clearTimeout(hi);
      window.clearTimeout(done);
      el?.classList.remove('dice-ceremony-highlight');
    };
  }, [phase, verdict]);

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

  const faceClass = 'dice-face-tile';

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(41,40,32,0.55)] backdrop-blur-sm flex items-center justify-center">
      {verdict.fumble && <div className="fumble-crack" />}
      <div className={`dice-stage ${verdict.fumble && !still ? 'dice-shake' : ''}`}>
        {verdict.crit && <div className="crit-glow" />}

        {/* One tile per die, each spinning its own value. `rolls` is the face
            list (rules/dice.ts) — never re-parse `dice` for the count. */}
        <div className="dice-stage__faces">
          {verdict.rolls.map((value, i) => (
            <div key={i} className={faceClass}>
              {phase === 'rolling' ? rollingFace(i, tick, value) : value}
            </div>
          ))}
        </div>

        <div className="dice-stage__caption">
          {verdict.desc !== '' && <span className="font-semibold">{verdict.desc}</span>}
          {verdict.expect !== '' && (
            <span className="font-mono text-xs">Requires: {verdict.expect}</span>
          )}
          {(verdict.name !== '' || verdict.dice !== '') && (
            <span className="font-mono text-xs text-ink/50">
              {verdict.name}
              {verdict.name !== '' && verdict.dice !== '' ? ' · ' : ''}
              {verdict.dice}
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
                verdict.crit
                  ? 'dice-result-crit'
                  : verdict.fumble
                    ? 'dice-result-fumble'
                    : 'text-ink'
              }`}
            >
              {verdict.result}
            </div>
            {badge(verdict.passed)}
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
