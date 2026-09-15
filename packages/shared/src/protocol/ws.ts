/**
 * AIRP WebSocket vocabulary — the ONE place frame names, close codes and the
 * protocol version are written down.
 *
 * Boundaries (docs/gateway/00 §1, decision R0):
 *   - No I/O, no state, no `ws` import, no `node:*` import. The browser imports
 *     this file too; anything Node-only here is a build break in `@airp/web`.
 *   - Pure shape only. The WS shell lives in `apps/server/src/index.ts`; the
 *     session domain is `apps/server/src/engine/lifecycle.ts`.
 *   - Frame names and event `type`s are DIFFERENT namespaces (docs/tools/00
 *     §5.3). Nothing here may be added to `schemas/events.ts`'s closed fifteen.
 */

/** WS query parameter `?v=` — a mismatch closes with 4400 (docs/gateway/03 §3). */
export const PROTOCOL_VERSION = '1' as const;

/**
 * One code, one meaning. `UNAUTHORIZED` is a PLACEHOLDER: AIRP has no auth
 * today, but the code's slot is frozen so adding auth never changes the
 * protocol (docs/development/后端实现计划.md §2.3).
 */
export const WS_CLOSE = Object.freeze({
  PROTOCOL_MISMATCH: 4400,
  UNAUTHORIZED: 4401, // placeholder — no auth implementation in this batch
  NOT_FOUND: 4404,
  GOING_AWAY: 1001,
} as const);

export type CloseKind = 'protocol' | 'auth' | 'session';

/**
 * The ONLY classifier for a close code. `null` means "not a protocol-level
 * verdict" — the caller treats it as a network blip and may retry. The browser
 * clamps illegal codes to 1005/1006, which must land here as `null` too:
 * sniffing `reason` strings is forbidden (docs/development/后端实现计划.md §2.1 #4).
 */
export function closeKind(code: number | undefined | null): CloseKind | null {
  switch (code) {
    case WS_CLOSE.PROTOCOL_MISMATCH:
      return 'protocol';
    case WS_CLOSE.UNAUTHORIZED:
      return 'auth';
    case WS_CLOSE.NOT_FOUND:
    case WS_CLOSE.GOING_AWAY:
      return 'session';
    default:
      // Includes the browser's reserved codes (1005 no-status, 1006 abnormal
      // close), 0, negatives, and any code we did not declare. `null` is a
      // deliberate verdict: "not ours, treat as a network blip".
      return null;
  }
}

/** Client → server command names. TODAY'S names, not a future rename
 *  (docs/gateway/00 §3.3). No `get_state`/`set_state`/`watch_state` — banned by
 *  AGENTS.md §2. */
export const WS_COMMANDS = Object.freeze([
  'writer_prompt', 'airp_init', 'writer_abort', 'abort',
  'character_start', 'character_prompt', 'character_abort', 'character_stop',
] as const);

/** Frames the GATEWAY synthesises (not passthrough from the engine). Only
 *  `replay_done` in this batch (docs/gateway/00 §3.2); everything else in
 *  docs/tools/12 §6.2 is emitted by `event-bridge` from engine events or by
 *  the watcher/routes. */
export const GATEWAY_EVENTS = Object.freeze(['replay_done'] as const);

/** Complete turns replayed on connect (docs/development/后端实现计划.md §9:126/:606).
 *  At most N COMPLETE turns — the trailing half turn is trimmed (00 §7 裁决 I). */
export const REPLAY_TURNS = 5;

/** Frames allowed into the replay ring (00 §3.1, 裁决 D). An ALLOWLIST, not a
 *  denylist: `*_delta`, ritual frames and meta frames never enter. */
export const REPLAY_FRAME_ALLOWLIST = Object.freeze([
  'chalk_writing', 'chalk_landed', 'card_writing', 'writer_message', 'writer_idle',
] as const);

/** Upper bound of the replay ring; entries are filtered by the allowlist above
 *  BEFORE they are pushed (00 §3.1). */
export const REPLAY_BUFFER_KEEP = 4000;

/**
 * Local failsafe for the replay window (docs/gateway/02 §7). `replayTo` is
 * synchronous, so the ONLY way `replay_done` fails to arrive on a live socket is
 * an exception path on the server. Without this the client would hold the writer
 * input lock forever, silently. The client must NOT stay silent: after this
 * budget it force-clears `replaying` and surfaces a notice (docs/tools/00 hard
 * rule 4). This is the ONE tolerated client-side replay fallback.
 */
export const REPLAY_DONE_TIMEOUT_MS = 3000;

