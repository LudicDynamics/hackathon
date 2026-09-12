/**
 * Interactive-field rules (doc 06 §2.3). ZERO dependencies on purpose:
 * no zod, no yaml, no node builtins. `schemas/frontmatter.ts` imports THIS,
 * never the other way around, so the same pure functions can be imported by
 * the extension, the web front-end, `rules/dice.ts` and the unit tests.
 *
 * Everything that decides "which option is number N", "is this option visible",
 * "what is this entity called" and "how the three blocks read as text" lives
 * here, and only here. `look_at`, the UI, `choose` and `roll_dice` all consume
 * these functions, so the numbering can never drift between them (06 §3.5).
 */

/** Parse cap on the visible option list (06 §7.2). Parsing and display share it. */
export const CHOICE_LIMIT = 12;

export interface NormalizedOption {
  /** 1-based position in the VISIBLE list (invisible options do not take a number). */
  index: number;
  label: string;
  id?: string;
  when?: string;
  hint?: string;
  /** Visibility at parse time. false = condition not met, or no status at all. */
  visible: boolean;
}

export interface NormalizedChoice {
  mode: 'single' | 'multi';
  allowFree: boolean;
  freeHint?: string;
  /** Every option (invisible included), in author order. */
  options: NormalizedOption[];
}

export interface InteractiveFields {
  status: { data: Record<string, string | number | boolean | null>; label?: string; chart?: 'bars' } | null;
  choice: NormalizedChoice | null;
  roll_dice: { type: string; desc: string; expect: string; result?: number; passed?: boolean } | null;
}

/** The canonical all-null block. Never null itself, so consumers never null-check. */
export const EMPTY_INTERACTIVE_FIELDS: InteractiveFields = { status: null, choice: null, roll_dice: null };

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * One scalar, normalized the same way on BOTH sides of a `when` comparison
 * (§3.5): quotes stripped, `true`/`false`/`null`/`~` folded, numeric literals
 * folded to number. `when: k == 1` and `when: k == "1"` are therefore the same
 * test, and so is a status value written as `"1"`.
 */
function normalizeScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  let s = String(value).trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    s = s.slice(1, -1);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (s !== '' && !Number.isNaN(Number(s))) return Number(s);
  return s;
}

/**
 * Parsed shape of a `when` expression, or null when malformed.
 * Grammar is deliberately tiny: `<flatKey> ("==" | "!=") <scalar>`.
 * Anything else (`===`, `>`, parens, `and`, empty) is malformed → fail-closed.
 */
function parseWhen(when: string): { key: string; op: '==' | '!='; value: string } | null {
  if (typeof when !== 'string') return null;
  const trimmed = when.trim();
  if (trimmed === '') return null;
  const m = trimmed.match(/^([^\s=!<>()]+)\s*(==|!=)\s*(.+)$/);
  if (!m) return null;
  const [, rawKey, op, value] = m;
  // `k === 1` matches op `==` and leaves `= 1` as the value; reject it explicitly
  // so the author gets the error rather than a comparison against the literal "= 1".
  if (value.trim().startsWith('=')) return null;
  // Both sides may be quoted (`when: "lid" == "open"`), so strip the key's quotes
  // too; the two spellings must be equivalent (06 §3.5).
  const key = rawKey.replace(/^["']|["']$/g, '');
  return { key, op: op as '==' | '!=', value: value.trim() };
}

/**
 * Single-condition predicate (§3.5). Reads only this entity's own `status.data`.
 * A missing key is `undefined`; a malformed expression is always false.
 */
export function evalWhen(when: string, statusData: Record<string, unknown> | null): boolean {
  const parsed = parseWhen(when);
  if (!parsed) return false;
  const left = normalizeScalar(statusData ? statusData[parsed.key] : undefined);
  const right = normalizeScalar(parsed.value);
  return parsed.op === '==' ? left === right : left !== right;
}

/**
 * The ONLY extraction point from raw frontmatter (§3.3). `parseFrontmatter`
 * calls it; nothing else digs into the raw keys.
 *
 * A malformed sub-structure makes THAT key null (never a half-widget) and
 * appends one human-readable line to `errors` when a sink is supplied. Raw
 * frontmatter is never mutated or dropped (§3.3 ③).
 */
export function buildInteractiveFields(
  raw: Record<string, any> | null | undefined,
  errors?: string[]
): InteractiveFields {
  const note = (msg: string): void => {
    if (errors) errors.push(msg);
  };
  if (!isPlainObject(raw)) return EMPTY_INTERACTIVE_FIELDS;

  const status = buildStatus(raw.status, note);
  const choice = buildChoice(raw.choice, status ? status.data : null, note);
  const roll_dice = buildRollDice(raw.roll_dice, note);
  return { status, choice, roll_dice };
}

function buildStatus(value: unknown, note: (msg: string) => void): InteractiveFields['status'] {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) {
    note('status must be a mapping with a "data" mapping');
    return null;
  }

  let label: string | undefined;
  if (value.label !== undefined) {
    if (typeof value.label === 'string') label = value.label;
    else {
      note('status.label must be a string');
      return null;
    }
  }

  let chart: 'bars' | undefined;
  if (value.chart !== undefined) {
    if (value.chart === 'bars') chart = 'bars';
    else {
      note(`status.chart must be "bars" when present, got ${JSON.stringify(value.chart)}`);
      return null;
    }
  }

  // Canonical form is `status: { data: {...} }`; the flat form `status: {k: v}`
  // (no `data` key) is tolerated and read as the data itself (03 §5.3).
  const nested = isPlainObject(value.data);
  const source = nested ? value.data : value;
  const data: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(source)) {
    if (!nested && (k === 'label' || k === 'chart' || k === 'data')) continue;
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      data[k] = v;
    } else {
      note(`status.data.${k} must be a scalar (string | number | boolean | null)`);
      return null;
    }
  }
  return {
    data,
    ...(label !== undefined ? { label } : {}),
    ...(chart !== undefined ? { chart } : {}),
  };
}

function buildChoice(
  value: unknown,
  statusData: Record<string, unknown> | null,
  note: (msg: string) => void
): NormalizedChoice | null {
  if (value === undefined || value === null) return null;

  let mode: 'single' | 'multi' = 'single';
  let allowFree = false;
  let freeHint: string | undefined;
  let optionList: unknown[];

  if (Array.isArray(value)) {
    optionList = value;
  } else if (isPlainObject(value)) {
    if (value.mode !== undefined) {
      if (value.mode === 'single' || value.mode === 'multi') mode = value.mode;
      else {
        note(`choice.mode must be "single" or "multi", got ${JSON.stringify(value.mode)}`);
        return null;
      }
    }
    if (value.allow_free !== undefined) {
      if (typeof value.allow_free === 'boolean') allowFree = value.allow_free;
      else {
        note('choice.allow_free must be a boolean');
        return null;
      }
    }
    if (value.free_hint !== undefined) {
      if (typeof value.free_hint === 'string') freeHint = value.free_hint;
      else {
        note('choice.free_hint must be a string');
        return null;
      }
    }
    if (!Array.isArray(value.options)) {
      note('choice must be a list of options or a mapping with an "options" list');
      return null;
    }
    optionList = value.options;
  } else {
    note(`choice must be a list of options or a mapping with an "options" list, got ${JSON.stringify(value)}`);
    return null;
  }

  const options: NormalizedOption[] = [];
  let visibleCount = 0;
  for (const item of optionList) {
    let label: string | undefined;
    let id: string | undefined;
    let when: string | undefined;
    let hint: string | undefined;

    if (typeof item === 'string') {
      label = item;
    } else if (isPlainObject(item)) {
      if (typeof item.label === 'string' && item.label.length > 0) label = item.label;
      else {
        note('every choice option must have a non-empty "label"');
        return null;
      }
      if (item.id !== undefined) {
        if (typeof item.id === 'string' && item.id.length > 0) id = item.id;
        else {
          note(`choice option "${label}" has a non-string "id"`);
          return null;
        }
      }
      if (item.when !== undefined) {
        if (typeof item.when === 'string' && item.when.length > 0) when = item.when;
        else {
          note(`choice option "${label}" has an empty "when"`);
          return null;
        }
      }
      if (item.hint !== undefined) {
        if (typeof item.hint === 'string') hint = item.hint;
        else {
          note(`choice option "${label}" has a non-string "hint"`);
          return null;
        }
      }
    } else {
      note('every choice option must be a string or a mapping with a "label"');
      return null;
    }

    if (when !== undefined && parseWhen(when) === null) {
      note(`choice option "${label}" has a malformed when "${when}"; the option stays hidden (fail-closed)`);
    }

    // Visibility is decided once, here, so display and resolution share it (§3.5).
    const visible = when === undefined ? true : evalWhen(when, statusData);
    options.push({
      index: visible ? ++visibleCount : 0,
      label,
      ...(id !== undefined ? { id } : {}),
      ...(when !== undefined ? { when } : {}),
      ...(hint !== undefined ? { hint } : {}),
      visible,
    });
  }

  if (visibleCount > CHOICE_LIMIT) {
    note(`choice declares ${visibleCount} visible options; only the first ${CHOICE_LIMIT} are selectable`);
  }

  return { mode, allowFree, ...(freeHint !== undefined ? { freeHint } : {}), options };
}

function buildRollDice(value: unknown, note: (msg: string) => void): InteractiveFields['roll_dice'] {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) {
    note('roll_dice must be a mapping with "type", "desc" and "expect"');
    return null;
  }

  let type = '1d100';
  if (value.type !== undefined) {
    if (typeof value.type === 'string' && value.type.length > 0) type = value.type;
    else {
      note('roll_dice.type must be a non-empty string');
      return null;
    }
  }

  const desc = typeof value.desc === 'string' && value.desc.length > 0 ? value.desc : 'Check';

  if (typeof value.expect !== 'string' || value.expect.length === 0) {
    note('roll_dice is missing a non-empty "expect" comparison');
    return null;
  }

  let result: number | undefined;
  if (value.result !== undefined) {
    if (typeof value.result === 'number') result = value.result;
    else {
      note('roll_dice.result must be a number');
      return null;
    }
  }

  let passed: boolean | undefined;
  if (value.passed !== undefined) {
    if (typeof value.passed === 'boolean') passed = value.passed;
    else {
      note('roll_dice.passed must be a boolean');
      return null;
    }
  }

  return {
    type,
    desc,
    expect: value.expect,
    ...(result !== undefined ? { result } : {}),
    ...(passed !== undefined ? { passed } : {}),
  };
}

/**
 * The visible options, renumbered from 1, capped at `CHOICE_LIMIT`.
 * The UI, `look_at` and `choose` all call THIS, so the number a player sees and
 * the number `choose` accepts are produced by one function (§3.5 / 03 §5.2).
 */
export function visibleChoiceOptions(choice: NormalizedChoice): NormalizedOption[] {
  return choice.options.filter((o) => o.visible).slice(0, CHOICE_LIMIT);
}

/**
 * Resolve a caller's choice against the visible list (§3.2).
 * Order, first hit wins: `id` → exact label → case-insensitive label → index.
 * Text is intentionally preferred over a bare number: an option whose own text
 * is `"2"` must still be reachable, and a number always means "index".
 */
export function resolveChoice(
  choice: NormalizedChoice,
  input: string | number
): { option: NormalizedOption } | { error: 'not_found' | 'out_of_range' } {
  const visible = visibleChoiceOptions(choice);

  if (typeof input === 'string') {
    const byId = visible.find((o) => o.id !== undefined && o.id === input);
    if (byId) return { option: byId };

    const exact = visible.filter((o) => o.label === input);
    if (exact.length === 1) return { option: exact[0] };
    if (exact.length > 1) return { error: 'not_found' };

    const lower = input.toLowerCase();
    const ci = visible.filter((o) => o.label.toLowerCase() === lower);
    if (ci.length === 1) return { option: ci[0] };
    if (ci.length > 1) return { error: 'not_found' };
  }

  let index: number | null = null;
  if (typeof input === 'number') {
    if (!Number.isInteger(input)) return { error: 'out_of_range' };
    index = input;
  } else if (/^\d+$/.test(input.trim())) {
    index = Number(input.trim());
  }

  if (index !== null) {
    if (index < 1 || index > visible.length) return { error: 'out_of_range' };
    return { option: visible[index - 1] };
  }

  return { error: 'not_found' };
}

/** title → name → basename minus `.md` (§3.7). Shared by events, look_at and errors. */
export function entityName(fm: Record<string, any> | null | undefined, path: string): string {
  if (isPlainObject(fm)) {
    if (typeof fm.title === 'string' && fm.title.trim() !== '') return fm.title.trim();
    if (typeof fm.name === 'string' && fm.name.trim() !== '') return fm.name.trim();
  }
  const base = String(path ?? '').split('/').pop() ?? '';
  return base.endsWith('.md') ? base.slice(0, -3) : base;
}

/**
 * `[Status]` / `[Choices]` / `[Dice]`, in that fixed order, blocks joined by a
 * blank line (03 §5.3). Returns '' when all three are absent — `look_at`
 * appends this verbatim, so an empty string means "no block".
 * Input is RAW frontmatter; this builds the normalized fields itself.
 */
export function formatInteractiveText(raw: Record<string, any> | null | undefined): string {
  const fields = buildInteractiveFields(raw);
  const blocks: string[] = [];

  if (fields.status) {
    const lines = ['[Status]'];
    if (fields.status.label !== undefined) lines.push(fields.status.label);
    for (const [k, v] of Object.entries(fields.status.data)) {
      lines.push(`${k}: ${v === null ? 'null' : String(v)}`);
    }
    if (lines.length > 1 + (fields.status.label !== undefined ? 1 : 0)) blocks.push(lines.join('\n'));
  }

  if (fields.choice) {
    const visible = visibleChoiceOptions(fields.choice);
    if (visible.length > 0) {
      const lines = ['[Choices]'];
      for (const o of visible) lines.push(`${o.index}. ${o.label}${o.hint !== undefined ? ` — ${o.hint}` : ''}`);
      // Only a MALFORMED `when` earns a diagnostic line: a condition that is
      // simply false is invisible by design, and showing it would leak a locked
      // door's label to the player (03 §5.3 / §13.9). A broken one must be
      // visible, or the author never learns to fix it.
      for (const o of fields.choice.options) {
        if (!o.visible && o.when !== undefined && parseWhen(o.when) === null) {
          lines.push(`(hidden: "${o.label}" — malformed when "${o.when}")`);
        }
      }
      blocks.push(lines.join('\n'));
    }
  }

  if (fields.roll_dice) {
    const d = fields.roll_dice;
    const state =
      d.result === undefined
        ? 'not rolled'
        : `rolled ${d.result} — ${d.passed === true ? 'passed' : 'failed'}`;
    blocks.push(`[Dice]\n${d.desc} · ${d.type} · success ${d.expect} · ${state}`);
  }

  return blocks.join('\n\n');
}
