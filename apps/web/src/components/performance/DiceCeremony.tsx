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
import { createPortal } from 'react-dom';
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
import { releaseReveal } from '../../lib/reveal-gate.js';
import { useLocale } from '../../lib/i18n.js';
import { declaredDiceFaces, parseCommandReceipts, receiptLine } from '../../lib/world-command.js';

/** Reduced motion still rolls, just briefly: less movement, same information. */
const STILL_ROLL_MS = 180;
/** Face swap cadence while tumbling. */
const FACE_SPIN_MS = 90;
/** Highlight duration once settled. */
const HIGHLIGHT_MS = 800;
/** The 3D stage lingers after the dice land (docs/perform/D10骰子动画.md). */
const STAGE_HOLD_MS = 4_000;
interface DiceCeremonyProps {
  /** Canonical input, or the legacy App verdict alias during the mount migration. */
  verdict: DiceCeremonyInput | DiceFrameVerdict;
  /** End the ceremony (played out, dismissed, or interrupted by a layer switch). */
  onDone: () => void;
}

/** The frame path has no charge phase (docs/perform/02 §3.3). */
type CeremonyPhase = 'rolling' | 'settled';

/** The player-visible receipt, projected once per render from the raw payload. */
function CommandReceiptLine({ commands }: { commands: unknown }): React.ReactElement | null {
  const { t } = useLocale();
  const receipts = parseCommandReceipts(commands);
  const line = receiptLine(receipts, t);
  if (line === null) return null;
  return (
    <p
      className={`dice-stage__commands dice-stage__commands--${line.tone}`}
      data-command-status={receipts[0]?.status ?? 'applied'}
      // The wire code is machine vocabulary (docs/command/06 §7.1): kept
      // inspectable as data, never rendered as player text.
      {...(line.detail === undefined ? {} : { 'data-command-code': line.detail })}
    >
      {line.text}
    </p>
  );
}

export const DiceCeremony: React.FC<DiceCeremonyProps> = ({ verdict: rawVerdict, onDone }) => {
  const input: DiceCeremonyInput | null =
    'requestKey' in rawVerdict
      ? rawVerdict
      : toDiceCeremonyInput(
          rawVerdict,
          rawVerdict.source === 'character' ? 'character-frame' : 'writer-frame',
        );
  const stageDisplay = input ? diceStageDisplay(input.dice, input.rolls) : null;
  // The 3D stage settles the ceremony when its dice land, however long loading
  // the model and simulating the throw takes; a fixed timer used to settle (and
  // close) the ceremony before the animation had even started.
  const staged = stageDisplay !== null;
  // Faces of the DECLARED die, so the tumble can never show a value the die
  // cannot land on (docs/command/06 §11.3). `null` keeps the legacy guess.
  const faces = input ? declaredDiceFaces(input.dice) : null;
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
    if (staged) return;
    const spin = still ? null : window.setInterval(() => setTick((t) => t + 1), FACE_SPIN_MS);
    const timer = window.setTimeout(() => setPhase('settled'), still ? STILL_ROLL_MS : ROLL_MS);
    return () => {
      if (spin !== null) window.clearInterval(spin);
      window.clearTimeout(timer);
    };
  }, [phase, still, input, staged]);

  useEffect(() => {
    if (!input || phase !== 'settled') return;
    if (input.crit) playStinger('smile');
    else if (input.fumble) playStinger('shock');

    const el = document.querySelector<HTMLElement>(
      `.object[data-path="${CSS.escape(input.path)}"]`
    );
    el?.classList.add('dice-ceremony-highlight');
    const hi = window.setTimeout(() => el?.classList.remove('dice-ceremony-highlight'), HIGHLIGHT_MS);
    const done = window.setTimeout(() => {
      // Release the held layer refetch BEFORE ending the ceremony: that refetch
      // carries the cards the command just created, and they must land as the
      // mask lifts, not behind it (docs/command/06 §8.3).
      releaseReveal();
      onDoneRef.current();
    }, staged ? STAGE_HOLD_MS : SETTLE_MS);
    return () => {
      window.clearTimeout(hi);
      window.clearTimeout(done);
      // A layer switch forces the ceremony to end early (docs/perform/02 §7.2):
      // the gate must open with it, or the canvas never updates again.
      releaseReveal();
      el?.classList.remove('dice-ceremony-highlight');
    };
  }, [phase, input, staged]);

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
  // Portal to <body>: opened from a Chalk, the declared-action dialog is itself
  // a body portal (chrome band) and used to cover the rolling dice rendered
  // inside the shell's stacking context. The registered
  // `--depth-performance-ceremony` token sits above that chrome dialog and just
  // below dialogue (docs/ux/02 §6.2).
  return createPortal(
    <div
      style={{ zIndex: 'var(--depth-performance-ceremony)' }}
      className="fixed inset-0 bg-[rgba(41,40,32,0.55)] backdrop-blur-sm flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Dice result ceremony"
    >
      {input.fumble && <div className="fumble-crack" />}
      <div className={`dice-stage ${input.fumble && !still ? 'dice-shake' : ''}`}>
        {input.crit && <div className="crit-glow" />}
        {stageDisplay ? (
          <D10Stage
            dice={input.dice}
            rolls={input.rolls}
            settled={phase === 'settled'}
            onLanded={() => setPhase('settled')}
            integrated
          />
        ) : (
          <div className="dice-stage__faces">
            {input.rolls.map((value, i) => (
              <div key={i} className="dice-face-tile">
                {phase === 'rolling' ? rollingFace(i, tick, value, faces ?? undefined) : value}
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
            {/* The command receipt appears at the SETTLE mark, never during the
                tumble: showing it earlier would tell the player the outcome
                before the dice land (docs/command/06 §3.2 step 9). One silent
                line — `give` handing over three cards reads as "three cards are
                on the table", not three operations. */}
            <CommandReceiptLine commands={input.commands} />
            <button
              onClick={onDone}
              className="px-5 py-2 rounded-full bg-ink text-white text-xs font-semibold tracking-wide shadow-sm hover:opacity-80 transition-opacity"
            >
              DONE
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
