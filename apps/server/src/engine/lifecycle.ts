import { randomUUID } from 'node:crypto';
import { RpcClient } from '../../../../vendor/pi-rp/packages/coding-agent/dist/index.js';
import type { JsonAgentSessionEvent } from '../../../../vendor/pi-rp/packages/coding-agent/dist/index.js';

import { CHARACTER_ROLE_PREFIX } from '@airp/shared';

import { assertCharacterLaunchable, characterLaunch, hasExistingSession, writerLaunch } from './launch.js';
import { readModelPreferences, writeModelPreferences, type ModelPreference } from './model-preferences.js';
/** Raw WS frame produced by lifecycle itself (warmup replay), not by the engine event map. */
export type FrameSink = (message: Record<string, any>) => void;
/** Engine event sink — `eventBridge.emitEngine`. */
export type EventSink = (
  source: 'writer' | 'character',
  event: JsonAgentSessionEvent,
  characterId?: string,
  turnId?: string,
) => void;
export type ActivityFailureSink = (
  source: 'writer' | 'character',
  characterId: string | undefined,
  turnId: string,
  reason: 'timeout' | 'cancelled' | 'agent_stopped',
) => void;

export interface AgentLifecycleManagerOptions {
  repoRoot: string;
  vendorCliPath: string;
  eventSink?: EventSink;
  frameSink?: FrameSink;
  activityFailureSink?: ActivityFailureSink;
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
const MAX_TURN_DURATION_MS = 300000;

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
  private activityFailureSink: ActivityFailureSink | undefined;

  private writer: RpcClient | null = null;
  private writerWorld: string | null = null;
  private writerPing: NodeJS.Timeout | null = null;
  private writerRestarts = 0;
  private characterClients = new Map<string, RpcClient>();
  private turnTimeouts = new Map<string, NodeJS.Timeout>();
  private turnStartedAt = new Map<string, number>();
  private turnIds = new Map<string, string>();
  private writerQueue: Promise<void> = Promise.resolve();
  private queuedBeats = 0;
  private switchingModels = false;
  private progress = new Map<string, { stage: string; startedAt: number; updatedAt: number }>();

  isModelSwitching() { return this.switchingModels; }

  async modelStatus(worldRoot: string, includeModels = true) {
    const writer = await this.startWriter(worldRoot);
    const [state, models] = await Promise.all([writer.getState(), includeModels ? writer.getAvailableModels() : Promise.resolve([])]);
    const characters = await Promise.all([...this.characterClients].map(async ([id, client]) => {
      const s = await client.getState();
      return { id, model: s.model ? { provider: s.model.provider, id: s.model.id } : null, thinking: s.thinkingLevel };
    }));
    return { world: worldRoot, preferences: readModelPreferences(worldRoot),
      writer: { model: state.model ? { provider: state.model.provider, id: state.model.id } : null, thinking: state.thinkingLevel },
      characters, models: models.map(m => ({ provider: m.provider, id: m.id })),
      busy: this.switchingModels || this.queuedBeats > 0 || this.turnStartedAt.size > 0 || state.isStreaming,
      progress: Object.fromEntries(this.progress), active: [...this.turnStartedAt.keys()], queued: this.queuedBeats };
  }

  async changeModel(worldRoot: string, role: 'writer' | 'character', preference: ModelPreference) {
    if (this.switchingModels || this.queuedBeats || this.turnStartedAt.size) throw new Error('Wait for the current turn to finish before changing models.');
    this.switchingModels = true;
    const previous = readModelPreferences(worldRoot);
    try {
      const writer = await this.startWriter(worldRoot);
      const models = await writer.getAvailableModels();
      if (!models.some(m => m.provider === preference.provider && m.id === preference.model)) throw new Error('This model is not available in the engine.');
      writeModelPreferences(worldRoot, { ...previous, [role]: preference });
      if (role === 'writer') {
        await this.stopWriter();
        const next = await this.startWriter(worldRoot);
        const state = await next.getState();
        if (state.model?.id !== preference.model || state.model?.provider !== preference.provider) throw new Error('The engine did not activate the selected model.');
      } else {
        for (const id of [...this.characterClients.keys()]) {
          const next = await this.startCharacter(id, worldRoot);
          const state = await next.getState();
          if (state.model?.id !== preference.model || state.model?.provider !== preference.provider) throw new Error('The character did not activate the selected model.');
        }
      }
    } catch (error) {
      writeModelPreferences(worldRoot, previous);
      if (role === 'writer') await this.stopWriter();
      else await this.stopCharacters();
      throw error;
    } finally { this.switchingModels = false; }
    return this.modelStatus(worldRoot);
  }
  private writerStarting: { world: string; promise: Promise<RpcClient> } | null = null;

  /** Resolve player beats in order, including their file updates. */
  submitWriter(worldRoot: string, message: string): Promise<void> {
    if (this.switchingModels) return Promise.reject(new Error('Models are switching. Please try again shortly.'));
    this.queuedBeats++;
    const queuedWorld = this.writerStarting?.world ?? this.writerWorld;
    const pending = this.writerQueue.catch(() => {}).then(async () => {
      if (queuedWorld && (this.writerStarting?.world ?? this.writerWorld) !== queuedWorld) throw new Error('The active world changed.');
      const client = await this.startWriter(worldRoot);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { off(); void client.abort().catch(() => {}); reject(new Error('Writer response timed out. Please try again.')); }, MAX_TURN_DURATION_MS);
        const off = client.onEvent(event => {
          if (event.type !== 'agent_settled') return;
          clearTimeout(timer);
          off();
          resolve();
        });
        client.prompt(message).catch(error => { clearTimeout(timer); off(); reject(error); });
      });
    });
    const tracked = pending.finally(() => { this.queuedBeats--; });
    this.writerQueue = tracked;
    return tracked;
  }

  constructor(options: AgentLifecycleManagerOptions) {
    this.repoRoot = options.repoRoot;
    this.vendorCliPath = options.vendorCliPath;
    this.eventSink = options.eventSink;
    this.frameSink = options.frameSink;
    this.activityFailureSink = options.activityFailureSink;
  }

  /**
   * Start (or reuse) the world's writer.
   *
   * Reuse is deliberate: re-spawning the writer for the same world appends a
   * redundant `preset_change` entry to the session file every time. A different
   * world retires the old process first.
   */
  async startWriter(worldRoot: string): Promise<RpcClient> {
    if (this.writerStarting) {
      if (this.writerStarting.world === worldRoot) return this.writerStarting.promise;
      await this.writerStarting.promise.catch(() => {});
    }
    const promise = this.startWriterProcess(worldRoot);
    this.writerStarting = { world: worldRoot, promise };
    try { return await promise; }
    finally { if (this.writerStarting?.promise === promise) this.writerStarting = null; }
  }

  private async startWriterProcess(worldRoot: string): Promise<RpcClient> {
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
    assertCharacterLaunchable(worldRoot, characterId);
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
    const clientKey = `character:${characterId}`;
    const turnId = this.turnIds.get(clientKey);
    if (turnId) this.activityFailureSink?.('character', characterId, turnId, 'cancelled');
    this.clearTurnTimeout(clientKey);
    this.turnStartedAt.delete(clientKey);
    this.turnIds.delete(clientKey);
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
    const turnId = this.turnIds.get('writer');
    if (turnId) this.activityFailureSink?.('writer', undefined, turnId, 'cancelled');
    this.progress.delete('writer');
    this.clearTurnTimeout('writer');
    this.turnStartedAt.delete('writer');
    this.turnIds.delete('writer');
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
    const stages: Record<string, string> = { agent_start: 'Reading the scene', message_update: 'Writing the response', tool_execution_start: 'Updating the world', agent_settled: 'Ready for your next action' };
    let stage = stages[event.type];
    if (event.type === 'tool_execution_start') stage = event.toolName === 'chalk' ? 'Writing Chalk' : ['look_at', 'read', 'view_canvas'].includes(event.toolName) ? 'Reading the scene' : 'Updating the world';
    if (event.type === 'tool_execution_end' && event.toolName === 'chalk' && !event.isError) stage = 'Chalk is ready · finishing world updates';
    if (stage) {
      const now = Date.now();
      const previous = this.progress.get(clientKey);
      // Keep the landed indication during the final model response.
      if (event.type !== 'message_update' || !previous?.stage.startsWith('Chalk is ready')) {
        this.progress.set(clientKey, { stage, startedAt: event.type === 'agent_start' ? now : previous?.startedAt ?? now, updatedAt: now });
        if (event.type !== 'message_update' || stage !== previous?.stage) {
          this.frameSink?.({ type: 'agent_progress', source, ...(source === 'character' ? { characterId: clientKey.slice(10) } : {}), ...this.progress.get(clientKey), busy: event.type !== 'agent_settled' });
        }
      } else if (previous) {
        this.progress.set(clientKey, { ...previous, updatedAt: now });
      }
    }
    if (event.type === 'agent_start') {
      // Keep the legacy run-level watchdog; no turn identity is allocated here.
      this.turnStartedAt.set(clientKey, Date.now());
      this.armTurnTimeout(clientKey, client, source);
    } else if (event.type === 'turn_start') {
      const previousTurnId = this.turnIds.get(clientKey);
      if (previousTurnId) this.activityFailureSink?.(source, characterIdFromClientKey(clientKey), previousTurnId, 'agent_stopped');
      const nextTurnId = `${source}:${randomUUID()}`;
      this.turnIds.set(clientKey, nextTurnId);
      this.turnStartedAt.set(clientKey, Date.now());
      this.armTurnTimeout(clientKey, client, source);
    } else if (event.type === 'turn_end' || event.type === 'agent_settled') {
      this.clearTurnTimeout(clientKey);
      this.turnStartedAt.delete(clientKey);
    } else if (this.turnStartedAt.has(clientKey) && ['message_update', 'tool_execution_start', 'tool_execution_update', 'tool_execution_end'].includes(event.type)) {
      this.armTurnTimeout(clientKey, client, source);
    }
    let activeTurnId = this.turnIds.get(clientKey);
    if (!activeTurnId && ['tool_execution_start', 'tool_execution_update', 'tool_execution_end'].includes(event.type)) {
      activeTurnId = `orphan:${randomUUID()}`;
      this.turnIds.set(clientKey, activeTurnId);
    }
    this.eventSink?.(source, event, characterIdFromClientKey(clientKey), activeTurnId);
    if (event.type === 'turn_end' || event.type === 'agent_settled') this.turnIds.delete(clientKey);
  }

  private armTurnTimeout(clientKey: string, client: RpcClient, source: 'writer' | 'character'): void {
    const idleBudget = Number(process.env.AIRP_TURN_TIMEOUT_MS) > 0 ? Number(process.env.AIRP_TURN_TIMEOUT_MS) : DEFAULT_TURN_TIMEOUT_MS;
    this.clearTurnTimeout(clientKey);
    const remaining = MAX_TURN_DURATION_MS - (Date.now() - (this.turnStartedAt.get(clientKey) ?? Date.now()));
    const delay = Math.max(0, Math.min(idleBudget, remaining));
    const timer = setTimeout(() => {
      console.warn(
        `[AIRP Lifecycle] ${clientKey} exceeded ${remaining <= idleBudget ? 'total turn' : 'inactivity'} budget; aborting turn`
      );
      const turnId = this.turnIds.get(clientKey);
      if (turnId) this.activityFailureSink?.(source, characterIdFromClientKey(clientKey), turnId, 'timeout');
      this.turnStartedAt.delete(clientKey);
      this.turnIds.delete(clientKey);
      client.abort().catch(() => {});
      this.frameSink?.({
        type: 'turn_aborted',
        source,
        ...(source === 'character' ? { characterId: clientKey.slice('character:'.length) } : {}),
        reason: 'timeout',
        message: 'The writer took too long to respond. You can try again; completed world changes are kept.',
        timestamp: new Date().toISOString(),
      });
    }, delay);
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
    const turnId = this.turnIds.get('writer');
    if (turnId) this.activityFailureSink?.('writer', undefined, turnId, 'agent_stopped');
    this.turnIds.delete('writer');
    this.turnStartedAt.delete('writer');
    const dead = this.writer;
    this.writer = null;
    this.writerWorld = null;

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
