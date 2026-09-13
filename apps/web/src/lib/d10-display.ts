import { parseDiceType } from '@airp/shared/dice';

export function diceStageDisplay(dice: string, rolls?: number[]) {
  const parsed = parseDiceType(dice);
  if (parsed.ok && parsed.value.faces === 10 && parsed.value.count === 2) {
    if (rolls && (rolls.length !== 2 || rolls.some(r => !Number.isInteger(r) || r < 1 || r > 10))) return null;
    return { faces: 10 as const, percentile: false, digits: rolls?.map(r => r % 10) ?? [0, 0],
      labels: ['D10 · 1', 'D10 · 2'], reading: rolls?.join(' + ') ?? '' };
  }
  if (parsed.ok && parsed.value.faces === 6 && parsed.value.count >= 1 && parsed.value.count <= 2) {
    if (rolls && (rolls.length !== parsed.value.count || rolls.some(r => !Number.isInteger(r) || r < 1 || r > 6))) return null;
    return { faces: 6 as const, percentile: false, digits: rolls ?? Array(parsed.value.count).fill(1),
      labels: Array.from({ length: parsed.value.count }, (_, i) => `D6 · ${i + 1}`), reading: rolls?.join(' + ') ?? '' };
  }
  const display = d10Display(dice, rolls);
  return display ? { ...display, faces: 10 as const } : null;
}

/** Presentation only: the server supplies rolls; modifiers never change faces. */
export function d10Display(dice: string, rolls?: number[]) {
  const parsed = parseDiceType(dice);
  if (!parsed.ok || parsed.value.count !== 1 || ![10, 100].includes(parsed.value.faces)) return null;
  const percentile = parsed.value.faces === 100;
  const value = rolls?.[0];
  if (rolls && (rolls.length !== 1 || !Number.isInteger(value) || value! < 1 || value! > parsed.value.faces)) return null;
  return {
    percentile,
    digits: value === undefined ? (percentile ? [0, 0] : [0]) : percentile
      ? [Math.floor((value % 100) / 10), value % 10] : [value % 10],
    labels: percentile ? ['×10', '×1'] : ['D10'],
    reading: value === undefined ? '' : percentile
      ? `${String(Math.floor((value % 100) / 10) * 10).padStart(2, '0')} + ${value % 10} → ${value}`
      : `${value % 10} → ${value}`,
  };
}
