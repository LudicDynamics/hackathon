import fs from 'node:fs';
import path from 'node:path';
import type { WebSocketServer } from 'ws';
import type { JsonAgentSessionEvent } from '../../../../vendor/pi-rp/packages/coding-agent/dist/index.js';
import type { LocalWorldStore } from '@airp/shared';
import { extractContentPrefix } from './chalk-delta.js';

export type EventSource = 'writer' | 'character';

/** Tail-read cadence (docs/tools/00 §5.3: "a ~1s fallback timer"). */
const TAIL_POLL_MS = 1000;
/** fs.watch debounce for the `file_changed` frame (B0 behaviour, unchanged). */
const WATCH_DEBOUNCE_MS = 150;

/**
 * Pulls the concatenated text blocks out of an assistant message.
 *
 * pi-rp message content is either a plain string or a block array; only `text`
 * blocks land on the canvas, so thinking/toolCall blocks are dropped here.
 */
export function messageText(message: unknown): string {
  const content = (message as { content?: unknown } | null)?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block): block is { type: string; text?: string } => typeof block === 'object' && block !== null)
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}

/**
 * Replay the buffered `chalk` argument fragments as `writer_delta` frames
 * (docs/perform/01 §3.2.1). Each frame carries the newly-decoded suffix since
 * the previous fragment, so the frontend accumulates ink progressively. If the
 * extractor ever lags the authoritative `content`, one final `mode:'replace'`
 * frame snaps the frontend to the truth (never a double-paste — R3/P1-1).
 */
function emitChalkDeltas(
  push: (msg: Record<string, unknown>) => void,
  frags: string[],
  toolCallId: string,
  authoritative: unknown,
): void {
  let acc = '';
  let prev = '';
  for (const frag of frags) {
    acc += frag;
    const got = extractContentPrefix(acc);
    if (got.text.length > prev.length) {
      push({ type: 'writer_delta', source: 'writer', delta: got.text.slice(prev.length), toolCallId });
      prev = got.text;
    }
  }
  const truth = typeof authoritative === 'string' ? authoritative : '';
  if (truth && prev !== truth) {
    push({ type: 'writer_delta', source: 'writer', delta: truth, toolCallId, mode: 'replace' });
  }
}

/**
 * Translates one pi-rp `JsonAgentSessionEvent` into zero or more AIRP WS messages.
 *
 * Deliberately a pure function — the bridge (and the probe) can call it directly
 * without a live WebSocket. `toolArgs` is the caller-owned call-id → args map that
 * lets `tool_execution_end` recover the path a `write`/`chalk` targeted; the
 * function reads and prunes it, so a long session never accumulates entries.
 *
 * Presentation frames and world-event `type`s are two namespaces (docs/tools/00
 * §5.3 / doc-21:276): everything here is a transient frame driven by a tool
 * return value, never an event row.
 *
 * Events outside the table (`agent_start`/`turn_*`/`message_start`/…) map to `[]`:
 * B0 forwards only the frames the frontend's ink/brush work consumes.
 */
export function mapEngineEvent(
  source: EventSource,
  event: JsonAgentSessionEvent,
  toolArgs: Map<string, unknown>,
  characterId?: string,
  toolcallBuf?: Map<number, string[]>,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  // A1: stamp every frame this call produces in ONE place. `characterId` is
  // omitted (not null/empty) for writer frames so the frontend's nullish
  // fallback (`detail.characterId ?? openOverlay`) keeps working.
  const push = (msg: Record<string, unknown>) =>
    out.push({
      ...msg,
      ...(characterId === undefined ? {} : { characterId }),
      timestamp: new Date().toISOString(),
    });

  switch (event.type) {
    case 'message_update': {
      const assistantEvent = event.assistantMessageEvent;
      // docs/perform/00 §3 — the writer's narration is the `chalk` TOOL's
      // `content` argument, NOT its text reply ("text that lives only in your
      // reply never reaches the player"). So a writer `text_delta` produces NO
      // frame; the writer lane is driven by `toolcall_delta` buffered until
      // `toolcall_end` confirms the tool is `chalk` (its name is unknown while
      // the argument fragments stream — docs/perform/00 §3.1).
      if (assistantEvent?.type === 'text_delta' && assistantEvent.delta && source !== 'writer') {
        push({ type: 'character_delta', source, delta: assistantEvent.delta });
      } else if (assistantEvent?.type === 'toolcall_delta' && assistantEvent.delta && source === 'writer' && toolcallBuf) {
        const frags = toolcallBuf.get(assistantEvent.contentIndex) ?? [];
        frags.push(assistantEvent.delta);
        toolcallBuf.set(assistantEvent.contentIndex, frags);
      } else if (assistantEvent?.type === 'toolcall_end' && source === 'writer' && toolcallBuf) {
        // Deferred confirmation: only NOW is `toolCall.name` known.
        const frags = toolcallBuf.get(assistantEvent.contentIndex) ?? [];
        toolcallBuf.delete(assistantEvent.contentIndex);
        const tc = assistantEvent.toolCall as { id?: string; name?: string; arguments?: { content?: unknown } } | undefined;
        if (tc?.name === 'chalk' && typeof tc.id === 'string') {
          emitChalkDeltas(push, frags, tc.id, tc.arguments?.content);
        }
      }
      break;
    }
    case 'message_end': {
      if (event.message?.role === 'assistant') {
        const text = messageText(event.message);
        if (text) {
          push({ type: source === 'writer' ? 'writer_message' : 'character_message', source, text });
        }
      }
      break;
    }
    case 'tool_execution_start': {
      toolArgs.set(event.toolCallId, event.args);
      push({ type: 'tool_start', source, toolName: event.toolName, toolCallId: event.toolCallId, args: event.args });
      if (event.toolName === 'chalk') {
        push({ type: 'chalk_writing', source, toolCallId: event.toolCallId });
      }
      break;
    }
    case 'tool_execution_update': {
      // doc-tools/11 §6.3 — `generate_image` is the only long-running tool that
      // streams progress; it belongs to the presentation channel, not history.
      if (event.toolName === 'generate_image') {
        const d = ((event.partialResult as { details?: Record<string, unknown> } | null)?.details ?? {}) as Record<string, unknown>;
        push({
          type: 'image_generation_progress',
          source,
          toolCallId: event.toolCallId,
          stage: d.stage,
          elapsedMs: d.elapsedMs,
          width: d.width,
          height: d.height,
        });
      }
      break;
    }
    case 'tool_execution_end': {
      const args = toolArgs.get(event.toolCallId) as { path?: unknown } | undefined;
      toolArgs.delete(event.toolCallId);
      // pi-rp forwards the WHOLE AgentToolResult (agent/src/types.ts:361-375),
      // so a tool's `details` live under `result.details`, never on `result`.
      const r = (event.result ?? null) as Record<string, unknown> | null;
      const details = (r?.details ?? {}) as Record<string, unknown>;
      push({
        type: 'tool_end',
        source,
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        isError: event.isError,
      });
      if (event.toolName === 'chalk' || event.toolName === 'write') {
        const landed: Record<string, unknown> = { type: 'chalk_landed', source, toolCallId: event.toolCallId };
        // doc-tools/02 §6.3: the path lives in `details.path`; the flat
        // `result.path` shape is legacy, kept so both work.
        const resultPath =
          (typeof r?.path === 'string' ? r.path : undefined) ??
          (typeof details.path === 'string' ? details.path : undefined);
        const targetPath = (typeof args?.path === 'string' ? args.path : undefined) ?? resultPath;
        if (targetPath) landed.path = targetPath;
        push(landed);
      }
      if (event.toolName === 'link' || event.toolName === 'arrange') {
        // doc-tools/09 §6.2: carry the details so the frontend patches in place
        // instead of re-fetching the whole layer.
        push({
          type: 'canvas_patched',
          source,
          layer: typeof details.layer === 'string' ? details.layer : undefined,
          kind: details.kind,
          action: details.action,
          links: Array.isArray(details.links) ? details.links : undefined,
          cards: Array.isArray(details.cards) ? details.cards : undefined,
        });
      }
      if (event.toolName === 'roll_dice' && !event.isError) {
        // docs/tools/00 §5.3: the PRESENTATION frame is `dice_result`; the EVENT
        // stays `roll_resolved` and reaches the canvas via the tail reader.
        // Field names are frozen by docs/tools/07 §6.2 — literally the same as
        // the HTTP response body so the frontend needs one type, not two.
        push({
          type: 'dice_result',
          source,
          path: details.path,
          name: details.name,
          dice: details.dice,
          desc: details.desc,
          expect: details.expect,
          result: details.result,
          passed: details.passed,
          rolls: details.rolls, // per-die faces, for the tumbling animation
          crit: details.crit, // big success banner
          fumble: details.fumble, // big failure banner
          layer: details.layer,
        });
      }
      if (event.toolName === 'show' && !event.isError) {
        // doc-tools/10 §6.2: broadcast the ShowFrame verbatim. A missing frame is
        // warned about, never faked — "宁可什么都不演，也不要演错的".
        if (details.frame && typeof details.frame === 'object') {
          push(details.frame as Record<string, unknown>);
        } else {
          console.warn('[EventBridge] show returned no details.frame; nothing broadcast.');
        }
      }
      if (event.toolName === 'generate_image' && !event.isError) {
        push({
          type: 'image_landed',
          source,
          toolCallId: event.toolCallId,
          asset: details.asset,
          mimeType: details.mimeType,
          width: details.width,
          height: details.height,
          reused: !!details.reused,
        });
      }
      break;
    }
    case 'agent_settled': {
      push({ type: source === 'writer' ? 'writer_idle' : 'character_idle', source });
      break;
    }
  }

  return out;
}

/** Read one websocket frame out of the sink in tests. */
interface BroadcastSink {
  clients: Iterable<{ readyState: number; send(payload: string): void }>;
}

export class EventBridge {
  private wss: BroadcastSink | null = null;
  private fileWatcher: fs.FSWatcher | null = null;
  private watchDebounceTimer: NodeJS.Timeout | null = null;
  private toolArgsByCallId = new Map<string, unknown>();
  /** Accumulated raw `toolcall_delta` fragments per contentIndex, until
   *  `toolcall_end` reveals the tool name (docs/perform/00 §3.1/§3.2). */
  private toolcallBuf = new Map<number, string[]>();

  private tailTimer: NodeJS.Timeout | null = null;
  /** Tail-read cursor: the highest `seq` already broadcast. */
  private lastSeq = 0;
  /** False until `getMaxSeq()` aligned the cursor — draining before that would replay all history. */
  private tailReady = false;
  /** Serialises drains — two concurrent reads would broadcast the same rows twice. */
  private draining: Promise<void> | null = null;
  /** The store the tail reader reads from; null until `startTailReader()`. */
  private tailStore: LocalWorldStore | null = null;
  /**
   * Bumped by every `startTailReader()` / `stopTailReader()`. A drain captures it
   * BEFORE its await; if a world switch happened in between, the stale batch is
   * discarded instead of writing `lastSeq` / broadcasting events from the OLD
   * world into the NEW one (REVIEW m-24).
   */
  private tailEpoch = 0;

  setWss(wss: WebSocketServer): void {
    this.wss = wss;
  }

  /**
   * Fan a frame out to every open client.
   *
   * Per-client try/catch: one half-dead socket must not abort the loop and starve
   * every other client. Without it a synchronous throw would propagate into the
   * drain loop, leaving `lastSeq` unadvanced — the tail reader would then retry
   * the SAME frame forever, stuck on that one bad socket.
   */
  broadcast(message: Record<string, unknown>): void {
    if (!this.wss) return;
    const payload = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState !== 1 /* OPEN */) continue;
      try {
        client.send(payload);
      } catch (err) {
        console.warn('[EventBridge] send failed, dropping frame for one client:', err);
      }
    }
  }

  /** Fan an engine event out to every WS client as the mapped AIRP frames. */
  emitEngine(source: EventSource, event: JsonAgentSessionEvent, characterId?: string): void {
    // A buffered tool-call that never reached `toolcall_end` (aborted turn)
    // would leak across turns; clear it when the turn settles.
    if (event.type === 'message_end' || event.type === 'agent_settled') {
      this.toolcallBuf.clear();
    }
    for (const message of mapEngineEvent(source, event, this.toolArgsByCallId, characterId, this.toolcallBuf)) {
      this.broadcast(message);
    }
  }

  /**
   * docs/tools/00 §5.3 — the ONE channel that carries world events to the
   * frontend. Extensions cannot touch the WS (00 §1), so the server polls the
   * `events` table they write.
   *
   * Contract (docs/tools/01 §3.8): `appendEvent` returns only after COMMIT, so
   * every `seq` we read is final and monotonic; a missing row just means the
   * debounce has not elapsed and the next drain will see it.
   */
  async drainWorldEvents(): Promise<void> {
    if (this.draining) return this.draining; // serialise; two reads would duplicate rows
    const store = this.tailStore;
    const epoch = this.tailEpoch;
    // `!tailReady` guard: fs.watch can fire between startTailReader() and the
    // getMaxSeq() resolve. Draining then would start from 0 and replay the whole
    // history at the frontend. The ~1s fallback timer covers that gap.
    if (!store || !this.tailReady) return;

    this.draining = (async () => {
      try {
        const events = await store.getEventsSince(this.lastSeq);
        // World switch during the await: `store` is now closed and its seq
        // belongs to another history.db. Drop the batch — advancing lastSeq or
        // broadcasting here would leak the old world's events into the new one.
        if (epoch !== this.tailEpoch || store !== this.tailStore) return;
        // Advance BEFORE broadcasting: a throw inside broadcast must not make us
        // re-read and re-send the same batch forever.
        for (const event of events) {
          this.lastSeq = event.seq; // `getEventsSince` is ASC by seq (01 §3.3)
          this.broadcast({ type: 'world_event', event, timestamp: new Date().toISOString() });
        }
      } catch (err) {
        // Do NOT advance on read failure — a caught error with a bumped cursor
        // would drop those events permanently.
        console.warn('[EventBridge] tail read failed; cursor unchanged:', err);
      } finally {
        this.draining = null;
      }
    })();
    return this.draining;
  }

  /**
   * Align the cursor and start polling.
   *
   * `getMaxSeq()` at start is deliberate (docs/tools/01 §11.5): we do NOT replay
   * history, otherwise a fresh server would re-enact every event since the world
   * was created. Call again after a world switch — the new history.db has its own
   * sequence, and a stale cursor could permanently skip events.
   *
   * MUST run BEFORE `watchWorld()`: the watcher kicks `drain()`, and aligning
   * first keeps "align, then listen" unambiguous.
   */
  startTailReader(store: LocalWorldStore): void {
    this.stopTailReader(); // bumps tailEpoch: discards any in-flight drain
    const epoch = this.tailEpoch; // captured AFTER the bump, so it names this start
    this.tailStore = store;
    void store
      .getMaxSeq()
      .then((max) => {
        // A newer start may have happened while this read was in flight — its
        // cursor belongs to another history.db, so this value must not win.
        if (epoch !== this.tailEpoch) return;
        this.lastSeq = max;
      })
      .catch((err) => {
        console.warn('[EventBridge] getMaxSeq failed; starting from 0 (history will replay):', err);
        if (epoch !== this.tailEpoch) return;
        this.lastSeq = 0;
      })
      .finally(() => {
        // The alignment is async, so a newer startTailReader()/stopTailReader()
        // may have run while getMaxSeq was in flight. Installing the timer then
        // would leave a reader alive for a world nobody is watching (and a
        // second start would stack a second interval). Same epoch discipline as
        // the drain guard below, applied to the startup path.
        if (epoch !== this.tailEpoch) return;
        this.tailReady = true;
        this.tailTimer = setInterval(() => {
          void this.drainWorldEvents();
        }, TAIL_POLL_MS);
        this.tailTimer.unref?.();
      });
  }

  stopTailReader(): void {
    if (this.tailTimer) {
      clearInterval(this.tailTimer);
      this.tailTimer = null;
    }
    this.tailStore = null;
    this.tailReady = false;
    // Invalidate any in-flight drain: it captured the OLD epoch and will drop its
    // batch on resolve instead of writing lastSeq / broadcasting (REVIEW m-24).
    this.tailEpoch += 1;
    this.draining = null;
  }

  watchWorld(worldRoot: string): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    try {
      this.fileWatcher = fs.watch(worldRoot, { recursive: true }, (eventType, filename) => {
        // docs/tools/00 §5.3: `.airpworld` must NOT be filtered wholesale — that
        // hid history.db's WAL writes and made the tail reader dead (the bug at
        // the old line 138). Only two subtrees are "writes nobody needs a frame
        // for": assets (the `image_landed` frame already announced them) and
        // sessions (every agent turn appends, and each write would fire a drain
        // that returns nothing).
        const rel = (filename ?? '').split(path.sep).join('/');
        const ignored =
          rel.startsWith('.airpworld/assets/') ||
          rel.startsWith('.airpworld/sessions/') ||
          rel.startsWith('node_modules/') ||
          rel.includes('/node_modules/');

        // Always kick the tail reader, even for an ignored path or an undefined
        // `filename` (some platforms never supply one): something wrote, and a
        // history.db write is precisely the case this reader exists for.
        // `drainWorldEvents` is a no-op until `tailReady`, so this is safe during
        // startup.
        void this.drainWorldEvents();
        if (ignored || !rel) return;

        if (this.watchDebounceTimer) clearTimeout(this.watchDebounceTimer);
        this.watchDebounceTimer = setTimeout(() => {
          this.broadcast({
            type: 'file_changed',
            eventType,
            filename: rel,
            timestamp: new Date().toISOString(),
          });
        }, WATCH_DEBOUNCE_MS);
      });
    } catch (err) {
      console.warn('[EventBridge] Could not watch world directory:', err);
    }
  }

  close(): void {
    this.stopTailReader();
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = null;
    }
  }
}
