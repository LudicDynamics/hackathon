import { fail } from './errors.js';
import { registerAction } from './service.js';
import type { ActionContext, ActionResult } from './types.js';
import {
  COMPONENT_REGISTRY,
  componentDocOf,
  listComponents,
  type ComponentDoc,
} from '../components/registry.js';
import type { FieldDoc } from '../components/types.js';

/** Input shape of `get_component` (doc 10 §2.1). */
export interface GetComponentInput {
  component?: string | string[];
}

export interface GetComponentDetails {
  mode: 'index' | 'full';
  components: ComponentDoc[];
}

/** Total registered kinds — used in the error copy. */
const KIND_COUNT = Object.keys(COMPONENT_REGISTRY).length;

/** A path-looking argument is a call error of its own kind (doc 10 §7 E3). */
function looksLikePath(value: string): boolean {
  return value.includes('/') || value.endsWith('.md');
}

function isOneOf(input: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMPONENT_REGISTRY, input);
}

/** Index line: `note      core      A sticky sheet… [use_item_on target]`. */
// Two fixed columns, padded so the longest kind (`instrument`) still leaves a
// gap — a kind id is followed by at least one space before its pack.
function indexLine(doc: ComponentDoc): string {
  const marker = doc.channels.useItemTarget ? ' [use_item_on target]' : '';
  return `${doc.kind.padEnd(12)}${doc.pack.padEnd(10)}${doc.purpose}${marker}`;
}

function channelsOf(doc: ComponentDoc): string {
  const c = doc.channels;
  const names: string[] = [];
  if (c.choice) names.push('choice');
  if (c.status) names.push('status');
  if (c.rollDice) names.push('roll_dice');
  if (c.useItemTarget) names.push('use_item_on-target');
  return names.length ? names.join(', ') : 'none';
}

function fieldLine(field: FieldDoc): string {
  const example = field.example ? `  e.g. ${field.example}` : '';
  return `  ${field.name.padEnd(16)}${field.type.padEnd(9)}${field.required ? 'required' : 'optional'}   ${field.desc}${example}`;
}

/** Full-mode block for one kind (doc 10 §2.1 template). */
function fullBlock(doc: ComponentDoc): string {
  const lines = [
    `[component: ${doc.kind}]  pack=${doc.pack}`,
    doc.purpose,
    `Click: ${doc.click}  ·  Channels: ${channelsOf(doc)}`,
    `Movable: ${doc.movable ? 'yes' : 'no'}  ·  Second layer: ${doc.secondLayer}  ·  Form: ${doc.form.w}x${doc.form.h} ${doc.form.chrome}`,
    '',
    'frontmatter fields',
    fieldLine({ name: 'component', type: 'string', required: true, desc: `kind id, literal "${doc.kind}"` }),
    fieldLine({ name: 'title', type: 'string', required: true, desc: 'card-face title' }),
    ...doc.fields
      .filter((f) => f.name !== 'title' && f.name !== 'component')
      .map((f) => fieldLine(f)),
    '',
    'minimal example',
    doc.example,
    '',
    `related: ${doc.related.join(', ')}`,
  ];
  return lines.join('\n');
}

function indexText(docs: ComponentDoc[]): string {
  const core = docs.filter((d) => d.pack === 'core').length;
  const pack = docs.length - core;
  const header = `[components] ${docs.length} registered (${core} core + ${pack} pack)`;
  const rows = docs.map(indexLine);
  const footer = 'Call get_component({ component: "lock" }) for the full frontmatter contract.';
  return [header, ...rows, footer].join('\n');
}

/**
 * `get_component` — the read-only face of the component registry (doc 10).
 * No store writes, no canvas writes, no event: it only reads its own code-level
 * registry, which is why the whole module takes no `store` call at all.
 */
export async function getComponent(
  _ctx: ActionContext,
  input: GetComponentInput
): Promise<ActionResult<GetComponentDetails>> {
  const raw = input.component;

  if (raw === undefined || raw === null) {
    const docs = listComponents();
    return { text: indexText(docs), details: { mode: 'index', components: docs } };
  }

  const requested = Array.isArray(raw) ? raw : [raw];

  // E3: a path is not a kind. Checked before existence so the model gets the
  // "use look_at" hint rather than a generic unknown-kind message.
  const pathLike = requested.filter((k) => typeof k === 'string' && looksLikePath(k));
  if (pathLike.length === 1 && requested.length === 1) {
    fail(
      'invalid_argument',
      `"${pathLike[0]}" is a path, not a component kind. Use look_at for an entity, or get_component with a kind like "note".`
    );
  }

  // De-duplicate, preserving order (doc 10 §3.2 step 1).
  const seen = new Set<string>();
  const kinds: string[] = [];
  for (const k of requested) {
    if (typeof k !== 'string') {
      fail('invalid_argument', `component must be a kind id or an array of kind ids, got ${typeof k}`);
    }
    if (!seen.has(k)) {
      seen.add(k);
      kinds.push(k);
    }
  }

  const unknown = kinds.filter((k) => !isOneOf(k));
  if (unknown.length === 1 && kinds.length === 1) {
    fail(
      'not_found',
      `Unknown component "${unknown[0]}". Run get_component with no argument to list the ${KIND_COUNT} registered kinds.`
    );
  }
  if (unknown.length > 0) {
    const quoted = unknown.map((u) => `"${u}"`).join(', ');
    fail(
      'not_found',
      `Unknown component(s): ${quoted}. Run get_component with no argument to list the ${KIND_COUNT} registered kinds.`
    );
  }

  const docs = kinds.map((k) => componentDocOf(k)).filter((d): d is ComponentDoc => d !== null);
  const text = docs.map(fullBlock).join('\n\n');
  return { text, details: { mode: 'full', components: docs } };
}

registerAction('getComponent', (ctx, input) => getComponent(ctx, input as unknown as GetComponentInput));
