import React, { useState } from 'react';
import { Dices, CheckCircle2, AlertCircle } from 'lucide-react';

interface DiceRollerProps {
  filePath: string;
  rollDice: {
    type?: string;
    desc: string;
    expect: string;
    result?: number;
    passed?: boolean;
  };
  onRollComplete?: (result: number, passed: boolean) => void;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({
  filePath,
  rollDice,
  onRollComplete,
}) => {
  const [rolling, setRolling] = useState(false);
  const [cubeRotation, setCubeRotation] = useState({ x: 0, y: 0 });
  const [localResult, setLocalResult] = useState<number | undefined>(rollDice.result);
  const [localPassed, setLocalPassed] = useState<boolean | undefined>(rollDice.passed);

  const handleRoll = async () => {
    if (rolling) return;
    setRolling(true);

    // Dynamic 3D tumbling rotation
    const rx = 360 * 3 + Math.floor(Math.random() * 4) * 90;
    const ry = 360 * 3 + Math.floor(Math.random() * 4) * 90;
    setCubeRotation({ x: rx, y: ry });

    try {
      const res = await fetch('/api/dice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          rollType: rollDice.type || '1d100',
          expect: rollDice.expect,
        }),
      });
      const data = await res.json();
      setTimeout(() => {
        setLocalResult(data.result);
        setLocalPassed(data.passed);
        setRolling(false);
        onRollComplete?.(data.result, data.passed);
      }, 1200);
    } catch (err) {
      console.error('Failed to roll dice:', err);
      setRolling(false);
    }
  };

  const hasRolled = localResult !== undefined;

  return (
    <div className="mt-4 p-4 rounded-2xl bg-paper-wall/60 border border-ink/10 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Dices className="w-5 h-5 text-rust" />
          <span className="text-sm font-semibold tracking-wide text-ink">
            {rollDice.desc}
          </span>
        </div>
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-ink/5 text-ink/70">
          通过要求：{rollDice.expect}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="dice-scene cursor-pointer" onClick={handleRoll}>
            <div
              className="dice-cube"
              style={{
                transform: `rotateX(${cubeRotation.x}deg) rotateY(${cubeRotation.y}deg)`,
              }}
            >
              <div className="dice-face face-1">⚀</div>
              <div className="dice-face face-2">⚁</div>
              <div className="dice-face face-3">⚂</div>
              <div className="dice-face face-4">⚃</div>
              <div className="dice-face face-5">⚄</div>
              <div className="dice-face face-6">⚅</div>
            </div>
          </div>

          <div>
            {!hasRolled && !rolling && (
              <button
                onClick={handleRoll}
                className="px-4 py-1.5 rounded-full bg-rust hover:bg-rust-light text-white text-xs font-medium tracking-wide shadow-sm transition-all"
              >
                点击掷骰
              </button>
            )}

            {rolling && (
              <span className="font-mono text-xs text-ink/60 animate-pulse">
                命运骰子翻滚中...
              </span>
            )}

            {hasRolled && !rolling && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-bold text-ink">
                  {localResult}
                </span>
                {localPassed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 检定通过
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5" /> 检定失败
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
