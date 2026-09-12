import { z } from 'zod';

export const RollDiceSchema = z.object({
  type: z.string().default('1d100'),
  desc: z.string(),
  expect: z.string(), // Engine-readable expression e.g. ">50"
  result: z.number().optional(),
  passed: z.boolean().optional(),
});

export const StatusSchema = z.object({
  data: z.record(z.string(), z.any()),
});

export const InteractionFieldsSchema = z.object({
  roll_dice: RollDiceSchema.optional(),
  choice: z.array(z.string()).optional(),
  status: StatusSchema.optional(),
  actions: z.array(z.string()).optional(),
}).passthrough();

export const ChalkFrontmatterSchema = InteractionFieldsSchema.extend({
  type: z.literal('chalk'),
  title: z.string().optional(),
  link_to: z.string().optional(),
  append_to: z.string().optional(),
}).passthrough();

export type RollDice = z.infer<typeof RollDiceSchema>;
export type ChalkStatus = z.infer<typeof StatusSchema>;
export type ChalkFrontmatter = z.infer<typeof ChalkFrontmatterSchema>;

export function parseFrontmatter(rawContent: string): { frontmatter: Record<string, any> | null; body: string } {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: null, body: rawContent };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter: Record<string, any> = {};

  const lines = yamlBlock.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentSubKey: string | null = null;
  let inStatusData = false;
  let inChoice = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      inStatusData = false;
      inChoice = false;
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        currentKey = key;
        if (key === 'choice' || key === 'actions') {
          inChoice = true;
          if (val) {
            try {
              const list = JSON.parse(val);
              if (!Array.isArray(list) || !list.every(item => typeof item === 'string')) return { frontmatter: null, body: rawContent };
              frontmatter[key] = list;
            } catch { return { frontmatter: null, body: rawContent }; }
          } else frontmatter[key] = [];
        } else if (key === 'status') {
          frontmatter.status = { data: {} };
        } else if (key === 'roll_dice') {
          frontmatter.roll_dice = {};
        } else if (val) {
          // YAML-lite scalars. Quoted → always a string; otherwise true/false/
          // null and bare numbers get their real type (the same rule status.data
          // already applies). Without this `big: true` reaches the client as the
          // string "true" and every boolean flag renders as false.
          const quoted = /^["']/.test(val);
          const bare = val.replace(/^["']|["']$/g, '');
          frontmatter[key] = quoted
            ? bare
            : bare === 'true'
              ? true
              : bare === 'false'
                ? false
                : bare === 'null'
                  ? null
                  : bare !== '' && !isNaN(Number(bare))
                    ? Number(bare)
                    : bare;
        }
      }
      continue;
    }

    if (inChoice && (line.trim().startsWith('- '))) {
      const item = line.trim().slice(2).trim().replace(/^["']|["']$/g, '');
      frontmatter[currentKey!].push(item);
      continue;
    }

    if (currentKey === 'status' && line.trim().startsWith('data:')) {
      inStatusData = true;
      continue;
    }

    if (inStatusData && currentKey === 'status') {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const k = line.slice(0, colonIdx).trim();
        const v = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        frontmatter.status.data[k] = isNaN(Number(v)) ? v : Number(v);
      }
      continue;
    }

    if (currentKey === 'roll_dice') {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const k = line.slice(0, colonIdx).trim();
        let v: any = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (k === 'result' && !isNaN(Number(v))) v = Number(v);
        if (k === 'passed') v = v === 'true';
        frontmatter.roll_dice[k] = v;
      }
    }
  }

  if (!InteractionFieldsSchema.safeParse(frontmatter).success) return { frontmatter: null, body: rawContent };
  return { frontmatter, body };
}

export function stringifyChalk(frontmatter: Record<string, any>, body: string): string {
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(frontmatter)) {
    if ((k === 'choice' || k === 'actions') && Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
    } else if (k === 'status' && typeof v === 'object' && v?.data) {
      lines.push('status:');
      lines.push('  data:');
      for (const [sk, sv] of Object.entries(v.data)) {
        lines.push(`    ${sk}: "${sv}"`);
      }
    } else if (k === 'roll_dice' && typeof v === 'object' && v) {
      lines.push('roll_dice:');
      for (const [rk, rv] of Object.entries(v)) {
        lines.push(`    ${rk}: "${rv}"`);
      }
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(body);
  return lines.join('\n');
}
