/**
 * DiceRoller.tsx — fullscreen dice ceremony (T2.3).
 *
 * The server contract: POST { path } → {result, passed, crit, fumble}, posted
 * the moment the roll releases (authoritative first, doc-06 §roll order).
 * The 3D tween is purely visual. Pipeline:
 * overlay opens (warm-black dim) → hold a charge bar (~1.2s, rising tone)
 * → release → 1.2s cube tumble + dice-roll foley → settled result with
 * crit bloom / fumble crack effects. A plain tap auto-fills the bar instead
 * of rolling instantly.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Dices, CheckCircle2, AlertCircle } from 'lucide-react';
import { unlock, playFoley, playCharge, endCharge } from '../../lib/audio.js';

// Timing constants shared with the frame-driven DiceCeremony (docs/perform/02
// §11.3): both entry points must play the same beat. ROLL_MS / SETTLE_MS /
// FACES are imported directly; CHARGE_MS is exported so the set stays whole.
export const CHARGE_MS = 1200; // hold time for a full bar
const TAP_MS = 300; // presses shorter than this are taps → auto-fill
const AUTO_FILL_MS = 600; // tap auto-fill duration
export const ROLL_MS = 1200; // cube tween length (also the animation gate)
export const SETTLE_MS = 1300; // result lingers before the overlay auto-closes
const IDLE_TILT = { x: 12, y: 20 }; // resting pose before the roll

export const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

interface DiceRollerProps {
  filePath: string;
  rollDice: {
    desc: string;
    expect: string;
    result?: number;
    passed?: boolean;
  };
  onRollComplete?: (result: number, passed: boolean) => void;
}

type Phase = 'charging' | 'rolling' | 'settled';
type Effect = 'crit' | 'fumble' | null;

interface DiceVerdict {
  result: number;
  passed: boolean;
  /** 引擎算好的暴击 / 大失败（roll-dice.ts:168-169）。字段缺失（老 / 畸形响应）时
   *  保留 undefined，结算处回落旧阈值作防御。 */
  crit?: boolean;
  fumble?: boolean;
}

/** Boundary guard for the authoritative /api/dice response (untrusted JSON). */
function parseDiceVerdict(raw: unknown): DiceVerdict | null {
  // 判定式不变（只要求 result / passed）；crit / fumble 另带出来，缺失则 undefined。
  if (!raw || typeof raw !== 'object' || !('result' in raw) || !('passed' in raw)) return null;
  const { result, passed, crit, fumble } = raw as {
    result: unknown;
    passed: unknown;
    crit?: unknown;
    fumble?: unknown;
  };
  if (typeof result !== 'number' || typeof passed !== 'boolean') return null;
  return {
    result,
    passed,
    crit: typeof crit === 'boolean' ? crit : undefined,
    fumble: typeof fumble === 'boolean' ? fumble : undefined,
  };
}

export const DiceRoller: React.FC<DiceRollerProps> = ({
  filePath,
  rollDice,
  onRollComplete,
}) => {
  // Pre-rolled checks (server already resolved) just show the result card.
  const [rolled, setRolled] = useState<DiceVerdict | null>(() => {
    const r = rollDice.result;
    const p = rollDice.passed;
    return r !== undefined && p !== undefined ? { result: r, passed: p } : null;
  });
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('charging');
  const [effect, setEffect] = useState<Effect>(null);
  const [charge, setCharge] = useState(0);
  const [rotation, setRotation] = useState(IDLE_TILT);
  const [error, setError] = useState<string | null>(null);

  const heldRef = useRef(false);
  const chargeStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const pendingRef = useRef<{ anim: boolean; verdict: DiceVerdict | null }>({
    anim: false,
    verdict: null,
  });
  const completeRef = useRef(false);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };
  const cancelRaf = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  useEffect(
    () => () => {
      cancelRaf();
      clearTimers();
      endCharge();
    },
    []
  );

  const closeOverlay = () => {
    clearTimers();
    cancelRaf();
    endCharge();
    setOpen(false);
    setPhase('charging');
    setCharge(0);
    setEffect(null);
    setRotation(IDLE_TILT);
    // 清场同时清掉上一次的失败文案，避免跨次状态污染。
    setError(null);
    completeRef.current = false;
    pendingRef.current = { anim: false, verdict: null };
  };

  /** Called when both the cube tween has finished AND the server verdict
   *  landed — whichever comes last settles the roll. */
  const settleIfReady = () => {
    const { anim, verdict } = pendingRef.current;
    if (!anim || !verdict || completeRef.current) return;
    completeRef.current = true;
    setRolled(verdict);
    setPhase('settled');

    // Effects fire once, at settlement, per the doc order. crit / fumble come from
    // the engine's own response (roll-dice.ts:168-169); only when the field is
    // absent (legacy / malformed body) do we fall back to the old thresholds.
    const crit = verdict.crit ?? (verdict.passed && verdict.result >= 95);
    const fumble = verdict.fumble ?? (!verdict.passed && verdict.result <= 5);
    if (crit) {
      setEffect('crit');
      playFoley('crit-chime');
    } else if (fumble) {
      setEffect('fumble');
      playFoley('fumble-break');
    } else {
      setEffect(null);
    }

    // 落定即回报，接活 App 的 toast（本批 A-D3）。
    onRollComplete?.(verdict.result, verdict.passed);

    timersRef.current.push(window.setTimeout(closeOverlay, SETTLE_MS));
  };

  const rollDie = () => {
    setPhase('rolling');
    endCharge();
    // Random 1080°+ tumble that always lands on a 90°-multiple face.
    setRotation({
      x: 1080 + Math.floor(Math.random() * 4) * 90,
      y: 1080 + Math.floor(Math.random() * 4) * 90,
    });
    playFoley('dice-roll');
    pendingRef.current = { anim: false, verdict: null };

    // Verdict is posted immediately — the tween is pure theater.
    void (async () => {
      // 空路径前置守卫：不发请求，直接走可见失败（服务端只认非空 path）。
      if (filePath === '') {
        closeOverlay();
        setError('Could not roll: this card has no world-relative path.');
        return;
      }
      try {
        const res = await fetch('/api/dice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // 冻结请求体（docs/wiring/00 §6）：服务端只读 path；rollType / expect 由服务端从
          // frontmatter 自己解析，前端不发（避免第二份真相）。
          body: JSON.stringify({ path: filePath }),
        });
        // Body 只能读一次：先整块取出 JSON，再分别判失败 / 成功。
        const raw = await res.json().catch(() => null);
        const rawObj = raw as Record<string, unknown> | null;
        // 先判失败：非 2xx，或动作层 ok:false（含无 ok 字段的路由兜底体）。文案逐字透传。
        if (!res.ok || rawObj?.ok === false) {
          const msg =
            typeof rawObj?.error === 'string' ? rawObj.error : `/api/dice → ${res.status}`;
          throw new Error(msg);
        }
        const verdict = parseDiceVerdict(raw);
        if (!verdict) {
          throw new Error(`/api/dice → ${res.status} (response was not the expected shape)`);
        }
        pendingRef.current.verdict = verdict;
        settleIfReady();
      } catch (err) {
        console.error('Failed to roll dice:', err);
        // 失败必须可见：先 closeOverlay（内含 setError(null)）再 setError，
        // 顺序不可反，否则重置会覆盖失败文案。rolled 仍为 null → 卡片回到可点状态。
        closeOverlay();
        setError(`Could not roll: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();

    timersRef.current.push(
      window.setTimeout(() => {
        pendingRef.current.anim = true;
        settleIfReady();
      }, ROLL_MS)
    );
  };

  const startCharge = (e: React.PointerEvent) => {
    if (phase !== 'charging') return;
    void unlock(); // the ceremony surface is a gesture — resume audio here
    e.currentTarget.setPointerCapture?.(e.pointerId);
    heldRef.current = true;
    chargeStartRef.current = performance.now();
    cancelRaf();
    const tick = (now: number) => {
      const p = Math.min(1, (now - chargeStartRef.current) / CHARGE_MS);
      setCharge(p);
      playCharge(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const releaseCharge = () => {
    if (phase !== 'charging' || !heldRef.current) return;
    heldRef.current = false;
    cancelRaf();
    const holdMs = performance.now() - chargeStartRef.current;
    if (holdMs < TAP_MS) {
      // A plain tap: auto-fill the bar for drama, then release the roll.
      // The charge tone keeps riding up through the fill (rollDie ends it).
      const fillStart = performance.now();
      const fill = (now: number) => {
        const p = Math.min(1, (now - fillStart) / AUTO_FILL_MS);
        setCharge(p);
        playCharge(p);
        if (p < 1) rafRef.current = requestAnimationFrame(fill);
        else rollDie();
      };
      rafRef.current = requestAnimationFrame(fill);
    } else {
      rollDie();
    }
  };

  const cancelCharge = () => {
    if (phase !== 'charging' || !heldRef.current) return;
    heldRef.current = false;
    cancelRaf();
    endCharge();
    setCharge(0);
  };

  const openOverlay = () => {
    if (open || rolled) return;
    void unlock();
    completeRef.current = false;
    pendingRef.current = { anim: false, verdict: null };
    setOpen(true);
    setPhase('charging');
    setCharge(0);
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

  const cube = (cubeClass: string, sceneClass: string) => (
    <div className={sceneClass}>
      <div className={cubeClass} style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
        {FACES.map((p, i) => (
          <div key={i} className={`dice-face face-${i + 1}`}>
            {p}
          </div>
        ))}
      </div>
    </div>
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
        /* Already resolved — show the result card, never re-enter the ceremony. */
        <div className="flex items-center gap-4">
          {cube('dice-cube', 'dice-scene')}
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold text-ink">{rolled.result}</span>
            {badge(rolled.passed)}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={openOverlay}
                className="px-4 py-1.5 rounded-full bg-rust hover:bg-rust-light text-white text-xs font-medium tracking-wide shadow-sm transition-all"
              >
                Roll the Dice
              </button>
              <span className="text-xs text-ink/50">Hold the die to charge the roll</span>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-xs text-rose-700">
              {error}
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-[rgba(41,40,32,0.55)] backdrop-blur-sm flex items-center justify-center">
          {effect === 'fumble' && <div className="fumble-crack" />}
          <div
            className={`relative flex flex-col items-center gap-8 py-10 px-16 rounded-3xl bg-paper-card/95 border border-ink/10 shadow-deep ${
              effect === 'fumble' ? 'dice-shake' : ''
            }`}
            onPointerDown={phase === 'charging' ? startCharge : undefined}
            onPointerUp={phase === 'charging' ? releaseCharge : undefined}
            onPointerCancel={phase === 'charging' ? cancelCharge : undefined}
          >
            {effect === 'crit' && <div className="crit-glow" />}

            {cube('dice-cube-ceremony', 'dice-scene-ceremony')}

            {phase === 'charging' && (
              <div className="w-64 flex flex-col items-center gap-3 select-none">
                <span className="font-mono text-xs tracking-[0.25em] text-ink/60 uppercase">
                  Hold to Roll
                </span>
                <div className="charge-bar">
                  <div className="charge-fill" style={{ width: `${charge * 100}%` }} />
                </div>
              </div>
            )}

            {phase === 'rolling' && (
              <span className="font-mono text-xs text-ink/60 animate-pulse tracking-widest uppercase">
                The dice of fate are spinning...
              </span>
            )}

            {phase === 'settled' && rolled && (
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`dice-result-number ${
                    effect === 'crit'
                      ? 'dice-result-crit'
                      : effect === 'fumble'
                        ? 'dice-result-fumble'
                        : 'text-ink'
                  }`}
                >
                  {rolled.result}
                </div>
                {badge(rolled.passed)}
                <button
                  onClick={closeOverlay}
                  className="px-5 py-2 rounded-full bg-ink text-white text-xs font-semibold tracking-wide shadow-sm hover:opacity-80 transition-opacity"
                >
                  DONE
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
