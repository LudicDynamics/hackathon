/**
 * 03 §2.3 — the ONE cursor settlement primitive, plus the rollback push-flat
 * anchor. Lives in `packages/shared/` because BOTH processes import it: the
 * writer extension and the character's server-side path
 * (`apps/server/src/index.ts`), and the server cannot import `extensions/`.
 *
 * Both functions NEVER throw: a cursor write failing must not fail a turn
 * (doc 00 §11).
 */
import type { WorldStore } from './world-store.js';

function warn(opts: { onWarn?: (message: string) => void }, message: string): void {
  if (opts.onWarn) opts.onWarn(message);
  else console.warn(message);
}

/**
 * The ONE settlement primitive. Called exactly once per consumption event:
 *   - writer:    at the TURN BOUNDARY, after the cached block was produced;
 *   - character: on overlay CLOSE, with `seq` pinned to the open-time high-water.
 *
 * Default `seq` = `await store.getMaxSeq()`. `writeCursor` is a BARE write — no
 * monotonic clamp, pushing "backwards" is legal, which is what makes the
 * pinned-`seq` form possible. No-op when `reader === null` (player / god /
 * engine have no cursor) or when `opts.advance === false`.
 */
export async function settleTurnCursor(
  store: WorldStore,
  reader: string | null,
  opts?: { advance?: boolean; seq?: number; onWarn?: (message: string) => void }
): Promise<void> {
  const warnOpts = { onWarn: opts?.onWarn };
  if (reader === null) return;
  if (opts?.advance === false) return;

  let seq = opts?.seq;
  if (seq === undefined) {
    try {
      seq = await store.getMaxSeq();
    } catch (err) {
      // Reading the high-water failed: treat as `advance: false` (no write).
      warn(
        warnOpts,
        `[cursor] getMaxSeq() failed for "${reader}"; cursor left unchanged: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return;
    }
  }

  try {
    await store.writeCursor(reader, seq);
  } catch (err) {
    // Worst case is "next turn repeats a span"; that beats failing the turn.
    warn(
      warnOpts,
      `[cursor] writeCursor("${reader}", ${seq}) failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * doc-21 §6: rollback pushes EVERY cursor to the max seq. NOT wired in this
 * batch — there is no rollback handler today (`service.ts` registers
 * `snapshotWorld`/`rollbackWorld` signatures only). Defined here so the handler,
 * when written, has one place to call: append `world_rolled_back` FIRST, then
 * call this in the SAME `historyDb` transaction.
 *
 * `getAllReadCursors` already exists for exactly this.
 */
export async function pushAllCursorsToMax(
  store: WorldStore,
  onWarn?: (message: string) => void
): Promise<void> {
  const warnOpts = { onWarn };
  let seq: number;
  try {
    seq = await store.getMaxSeq();
  } catch (err) {
    warn(
      warnOpts,
      `[cursor] pushAllCursorsToMax: getMaxSeq() failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return;
  }

  let cursors: Array<{ reader: string; seq: number }>;
  try {
    cursors = await store.getAllReadCursors();
  } catch (err) {
    warn(
      warnOpts,
      `[cursor] pushAllCursorsToMax: getAllReadCursors() failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return;
  }

  for (const row of cursors) {
    try {
      await store.writeCursor(row.reader, seq);
    } catch (err) {
      warn(
        warnOpts,
        `[cursor] pushAllCursorsToMax: writeCursor("${row.reader}", ${seq}) failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
