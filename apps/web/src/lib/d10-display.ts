import { parseDiceType } from '@airp/shared/dice';

export interface DiceStageDisplay {
  faces: 6 | 10;
  percentile: boolean;
  digits: number[];
  labels: string[];
  reading: string;
}

function validRolls(rolls: number[] | undefined, count: number, faces: number): boolean {
  return !rolls || (rolls.length === count && rolls.every((value) => Number.isInteger(value) && value >= 1 && value <= faces));
}

/**
 * Select the bounded physical renderer. The supplied rolls are authoritative;
 * this function only maps them to display faces and never computes a result.
 */
export function diceStageDisplay(dice: string, rolls?: number[]): DiceStageDisplay | null {
  const parsed = parseDiceType(dice);
  if (!parsed.ok) return null;
  const { count, faces } = parsed.value;

  if (faces === 10 && count === 2) {
    if (!validRolls(rolls, 2, 10)) return null;
    const values = rolls?.map((value) => value % 10) ?? [0, 0];
    return {
      faces: 10,
      percentile: false,
      digits: values,
      labels: ['D10 · 1', 'D10 · 2'],
      reading: rolls ? rolls.join(' + ') : '',
    };
  }

  if (faces === 6 && count >= 1 && count <= 2) {
    if (!validRolls(rolls, count, 6)) return null;
    const values = rolls ?? Array.from({ length: count }, () => 1);
    return {
      faces: 6,
      percentile: false,
      digits: [...values],
      labels: Array.from({ length: count }, (_, index) => `D6 · ${index + 1}`),
      reading: rolls ? rolls.join(' + ') : '',
    };
  }

  const d10 = d10Display(dice, rolls);
  return d10 ? { ...d10, faces: 10 } : null;
}

/** Presentation-only mapping for one D10 or percentile die. */
export function d10Display(
  dice: string,
  rolls?: number[],
): Omit<DiceStageDisplay, 'faces'> | null {
  const parsed = parseDiceType(dice);
  if (!parsed.ok || parsed.value.count !== 1 || ![10, 100].includes(parsed.value.faces)) return null;

  const percentile = parsed.value.faces === 100;
  const value = rolls?.[0];
  if (!validRolls(rolls, 1, parsed.value.faces)) return null;

  const digits = value === undefined
    ? percentile ? [0, 0] : [0]
    : percentile ? [Math.floor((value % 100) / 10), value % 10] : [value % 10];
  const tens = percentile && value !== undefined ? Math.floor((value % 100) / 10) * 10 : 0;

  return {
    percentile,
    digits,
    labels: percentile ? ['×10', '×1'] : ['D10'],
    reading: value === undefined ? '' : percentile
      ? `${String(tens).padStart(2, '0')} + ${value % 10} → ${value}`
      : `${value % 10} → ${value}`,
  };
}
