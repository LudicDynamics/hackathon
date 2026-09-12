import { RpcClient } from '../../../../vendor/pi-rp/packages/coding-agent/dist/index.js';
import type { JsonAgentSessionEvent } from '../../../../vendor/pi-rp/packages/coding-agent/dist/index.js';

import { CHARACTER_ROLE_PREFIX } from '@airp/shared';

import { characterLaunch, hasExistingSession, writerLaunch } from './launch.js';

/** Raw WS frame produced by lifecycle itself (warmup replay), not by the engine event map. */
export type FrameSink = (message: Record<string, any>) => void;
/** Engine event sink — `eventBridge.emitEngine`. */
export type EventSink = (
  source: 'writer' | 'character',
  event: JsonAgentSessionEvent,
  characterId?: string
) => void;

export interface AgentLifecycleManagerOptions {
  repoRoot: string;
  vendorCliPath: string;
  eventSink?: EventSink;
  frameSink?: FrameSink;
}

/**
 * `'character:nanami'` → `'nanami'`. Anything else (writer, empty id, other
 * keys) → `undefined`. Pure and exported so the derivation is unit-testable
 * without a live agent.
 *
 * Empty id returns `undefined` on purpose: the frontend falls back with
 * `detail.characterId ?? openOverlayId`, and `''` is not nullish.
 */
export function characterIdFromClientKey(clientKey: string): string | undefined {
  if (!clientKey.startsWith(CHARACTER_ROLE_PREFIX)) return undefined;
  const id = clientKey.slice(CHARACTER_ROLE_PREFIX.length);
  return id === '' ? undefined : id;
}

/** Warmup delay: give the engine a moment to finish restoring the resumed session. */
const WARMUP_DELAY_MS = { continued: 800 } as const;

/**
 * Crash-restart backoff (T0.5). The engine's RpcClient has no exit callback, so a
 * liveness probe notices death; these are the retry gaps, capped at 30s.
 */
const RESTART_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
const MAX_RESTART_ATTEMPTS = 5;
const LIVENESS_PROBE_MS = 5000;
const DEFAULT_TURN_TIMEOUT_MS = 90000;

/**
 * Owns pi-rp agent processes: one writer per world (reused), one character per id,
 * plus liveness probing, backoff restart, turn timeout safeguards, and warmup replay
 * of the custom entries emitted before our event subscription existed.
 *
 * Everything protocol-level lives in the vendored `RpcClient` — this class never
 * touches stdio or JSONL framing.
 */
export class AgentLifecycleManager {
  private repoRoot: string;
  private vendorCliPath: string;
  private eventSink: EventSink | undefined;
  private frameSink: FrameSink | undefined;

  private writer: RpcClient | null = null;
  private writerWorld: string | null = null;
  private writerPing: NodeJS.Timeout | null = null;
  private writerRestarts = 0;
  private characterClients = new Map<string, RpcClient>();
  private turnTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(options: AgentLifecycleManagerOptions) {
    this.repoRoot = options.repoRoot;
    this.vendorCliPath = options.vendorCliPath;
    this.eventSink = options.eventSink;
    this.frameSink = options.frameSink;
  }

  /**
   * Start (or reuse) the world's writer.
   *
   * Reuse is deliberate: re-spawning the writer for the same world appends a
   * redundant `preset_change` entry to the session file every time. A different
   * world retires the old process first.
   */
  async startWriter(worldRoot: string): Promise<RpcClient> {
    if (this.writer && this.writerWorld === worldRoot) return this.writer;
    if (this.writer) await this.stopWriter();

    const continued = hasExistingSession(worldRoot);
    const spec = writerLaunch(this.repoRoot, worldRoot, this.vendorCliPath);
    const client = new RpcClient({
      cliPath: spec.cliPath,
      cwd: spec.cwd,
      args: spec.args,
      env: spec.env,
    });
    client.onEvent((event) => this.handleEngineEvent('writer', event, 'writer', client));

    await client.start();
    this.writer = client;
    this.writerWorld = worldRoot;
    this.writerRestarts = 0;

    this.scheduleLivenessProbe(worldRoot);
    this.scheduleWarmup(client, continued ? 'continued' : 'none');
    return client;
  }

  getWriter(): RpcClient | null {
    return this.writer;
  }

  /** Starts a character agent. No context injection (removed in B0 — B3 rebuilds it via `appendMessage`). */
  async startCharacter(characterId: string, worldRoot: string): Promise<RpcClient> {
    await this.stopCharacter(characterId);

    const spec = characterLaunch(this.repoRoot, worldRoot, this.vendorCliPath, characterId);
    const client = new RpcClient({
      cliPath: spec.cliPath,
      cwd: spec.cwd,
      args: spec.args,
      env: spec.env,
    });
    client.onEvent((event) =>
      this.handleEngineEvent('character', event, `${CHARACTER_ROLE_PREFIX}${characterId}`, client)
    );

    await client.start();
    this.characterClients.set(characterId, client);
    return client;
  }

  getCharacter(characterId: string): RpcClient | null {
    return this.characterClients.get(characterId) ?? null;
  }

  async stopCharacter(characterId: string): Promise<void> {
    this.clearTurnTimeout(`character:${characterId}`);
    const client = this.characterClients.get(characterId);
    if (!client) return;
    this.characterClients.delete(characterId);
    await client.stop().catch(() => {});
  }

  /** Stops all active character agents (e.g. on world change). */
  async stopCharacters(): Promise<void> {
    const characters = [...this.characterClients.keys()];
    await Promise.all(characters.map((id) => this.stopCharacter(id)));
  }

  async stopWriter(): Promise<void> {
    this.clearTurnTimeout('writer');
    if (this.writerPing) {
      clearInterval(this.writerPing);
      this.writerPing = null;
    }
    const client = this.writer;
    this.writer = null;
    this.writerWorld = null;
    if (client) await client.stop().catch(() => {});
  }

  async stopAll(): Promise<void> {
    await Promise.all([this.stopWriter(), this.stopCharacters()]);
  }

  private handleEngineEvent(
    source: 'writer' | 'character',
    event: JsonAgentSessionEvent,
    clientKey: string,
    client: RpcClient
  ): void {
    if (event.type === 'agent_start') {
      this.armTurnTimeout(clientKey, client, source);
    } else if (event.type === 'agent_settled') {
      this.clearTurnTimeout(clientKey);
    }
    this.eventSink?.(source, event, characterIdFromClientKey(clientKey));
  }

  private armTurnTimeout(clientKey: string, client: RpcClient, source: 'writer' | 'character'): void {
    this.clearTurnTimeout(clientKey);
    const timer = setTimeout(() => {
      console.warn(
        `[AIRP Lifecycle] ${clientKey} turn exceeded ${DEFAULT_TURN_TIMEOUT_MS}ms; aborting runaway turn`
      );
      client.abort().catch(() => {});
      this.frameSink?.({
        type: 'turn_aborted',
        source,
        reason: 'timeout',
        timestamp: new Date().toISOString(),
      });
    }, DEFAULT_TURN_TIMEOUT_MS);
    timer.unref?.();
    this.turnTimeouts.set(clientKey, timer);
  }

  private clearTurnTimeout(clientKey: string): void {
    const existing = this.turnTimeouts.get(clientKey);
    if (existing) {
      clearTimeout(existing);
      this.turnTimeouts.delete(clientKey);
    }
  }

  /**
   * The engine client exposes no exit event, so poll it: a dead process makes every
   * request throw. `startWriter` is what the retry path calls, so its reuse guard
   * makes a spurious probe harmless — but only clear `writer` once, on real death.
   */
  private scheduleLivenessProbe(worldRoot: string): void {
    const client = this.writer;
    if (!client) return;
    this.writerPing = setInterval(() => {
      client.getSessionStats().catch(() => {
        if (this.writer !== client) return;
        void this.handleWriterDeath(worldRoot);
      });
    }, LIVENESS_PROBE_MS);
  }

  private async handleWriterDeath(worldRoot: string): Promise<void> {
    if (this.writerPing) {
      clearInterval(this.writerPing);
      this.writerPing = null;
    }
    const dead = this.writer;
    this.writer = null;
    this.writerWorld = null;
    if (dead) await dead.stop().catch(() => {});

    if (this.writerRestarts >= MAX_RESTART_ATTEMPTS) {
      console.error(
        `[AIRP Lifecycle] writer for "${worldRoot}" died ${MAX_RESTART_ATTEMPTS} times; giving up (manual restart required)`
      );
      return;
    }
    const delay = RESTART_BACKOFF_MS[Math.min(this.writerRestarts, RESTART_BACKOFF_MS.length - 1)];
    this.writerRestarts++;
    console.warn(
      `[AIRP Lifecycle] writer died; restarting in ${delay}ms (attempt ${this.writerRestarts}/${MAX_RESTART_ATTEMPTS})`
    );
    setTimeout(() => {
      this.startWriter(worldRoot).catch((err) => {
        console.error('[AIRP Lifecycle] writer restart failed:', err);
        void this.handleWriterDeath(worldRoot);
      });
    }, delay);
  }

  /**
   * Pull the introspected session's custom entries back over the wire (T0.6).
   *
   * pi-rp's rpc-mode subscribes to session events only inside `rebindSession()`, which
   * runs *after* the `session_start` hook — so anything emitted during session setup
   * (choice groups, opening-tree nodes, …) reaches nobody. Those live in the session's
   * custom entries and are recoverable on demand; we ask for them once a resumed writer
   * is up and re-broadcast them as `replay_entry` frames.
   *
   * `get_messages` is deliberately **not** used. In AIRP the narrative is chalk markdown
   * on disk and chat history never reaches the canvas (doc-05 §5) — replaying messages
   * would only push the writer's intermediate reasoning back at the player.
   */
  private scheduleWarmup(client: RpcClient, tier: 'continued' | 'none'): void {
    if (tier === 'none') return;
    const timer = setTimeout(() => {
      void (async () => {
        const entries = await client
          .getEntries()
          .then((result) => result.entries)
          .catch(() => null);
        if (this.writer !== client) return;

        for (const entry of entries ?? []) {
          if (entry.type === 'custom') {
            this.frameSink?.({ type: 'replay_entry', source: 'writer', entry });
          }
        }
      })();
    }, WARMUP_DELAY_MS.continued);
    timer.unref?.();
  }
}
