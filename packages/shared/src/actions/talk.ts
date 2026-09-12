/**
 * doc 12 §3.5 — `noteCharacterTalked`.
 *
 * One `character_talked` event per CLOSE of the character overlay, never per
 * line (doc-21 §4.2): the writer should learn "the player went to talk to
 * Watson" — a story beat — not receive the transcript (that lives in the
 * `entries` table and would blow up the writer's context).
 *
 * `turns` is a self-report from the frontend. The review (M-8) confirmed no
 * counter exists there yet and no `character_stop` is sent, so B1 defaults to
 * `1` and marks it with `turnsEstimated: true` rather than pretending precision.
 */
import type { WorldEvent } from '../schemas/events.js';
import { parseFrontmatter } from '../schemas/frontmatter.js';
import { ActionError } from './errors.js';
import { registerAction } from './service.js';
import type { ActionContext, ActionResult } from './types.js';

export interface NoteCharacterTalkedInput {
  /** The character id (a `characters/<id>/` directory name). */
  character: string;
  /** How many exchanges the overlay saw; defaults to 1. */
  turns?: number;
  /** True when the caller could not know the real count (B1's default path). */
  turnsEstimated?: boolean;
}

export interface NoteCharacterTalkedDetails {
  character: string;
  name: string;
  turns: number;
  turnsEstimated: boolean;
  event: WorldEvent;
}

export async function noteCharacterTalked(
  ctx: ActionContext,
  input: NoteCharacterTalkedInput
): Promise<ActionResult<NoteCharacterTalkedDetails>> {
  const { character } = input;
  if (!character || character.trim() === '') {
    throw new ActionError({ code: 'invalid_argument', message: 'A character id is required.' });
  }

  const readme = `characters/${character}/README.md`;
  const exists = await ctx.store.statKind(readme);
  if (exists === 'missing') {
    throw new ActionError({
      code: 'not_found',
      message: `No character "${character}" (looked for ${readme}).`,
    });
  }

  // The reading of the name happens here, while the file is known to exist, so
  // the stored detail stays self-sufficient (doc-21 §3.3).
  let name = character;
  try {
    const { frontmatter } = parseFrontmatter(await ctx.store.readFile(readme));
    if (typeof frontmatter?.name === 'string' && frontmatter.name.trim() !== '') {
      name = frontmatter.name;
    }
  } catch {
    // Keep the id as the name rather than failing the whole action.
  }

  const raw = input.turns;
  const turnsEstimated = input.turnsEstimated === true || raw === undefined;
  const turns = Number.isFinite(raw) && (raw as number) > 0 ? Math.floor(raw as number) : 1;

  // A character is not a layer, so `layer` is null and the subject is the
  // character's README (01 §4 ledger row for `character_talked`).
  const event = await ctx.store.appendEvent({
    type: 'character_talked',
    actor: ctx.actor,
    detail: { character, name, turns },
    subject: readme,
    turn: ctx.turn,
  });

  return {
    text: `The player spoke with "${name}" (${turns} exchange${turns === 1 ? '' : 's'}).`,
    details: { character, name, turns, turnsEstimated, event },
  };
}

registerAction('noteCharacterTalked', (ctx, input) =>
  noteCharacterTalked(ctx, input as unknown as NoteCharacterTalkedInput)
);
