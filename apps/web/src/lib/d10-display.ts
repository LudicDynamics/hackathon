import { parseDiceType } from '@airp/shared/dice';

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
