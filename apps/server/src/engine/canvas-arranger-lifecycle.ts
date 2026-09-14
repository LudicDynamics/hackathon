import { randomUUID } from 'node:crypto';
import { RpcClient } from '../../../../vendor/pi-rp/packages/coding-agent/dist/index.js';
import type { JsonAgentSessionEvent } from '../../../../vendor/pi-rp/packages/coding-agent/dist/index.js';
import { readCanvasSnapshot } from '@airp/shared';
import type { ArrangeCanvasDetails, LocalWorldStore } from '@airp/shared';
import { canvasArrangerLaunch, type LaunchSpec } from './launch.js';

export interface CanvasArrangeRequest {
  worldId: string;
  layer: string;
  mode: 'grid' | 'circle' | 'row';
  requestId: string;
  expectedRevision: number;
  expectedCanvasVersion: number;
  snapshotId: string;
  screenshotPolicy: 'none' | 'before' | 'after' | 'before_and_after';
}

export interface CanvasArrangeAccepted {
  ok: true;
  operationId: string;
  requestId: string;
  worldId: string;
  layer: string;
  agentId: 'canvas-arranger';
  turnId: `functional:canvas-arranger:${string}`;
  stage: 'accepted';
}

export type CanvasArrangerRuntimeSignal = {
  type: 'spawned' | 'tool_started' | 'tool_completed' | 'committed' | 'verified' | 'failed' | 'cancelled' | 'conflict';
  operationId: string;
  requestId: string;
  worldId: string;
  layer: string;
  agentId: 'canvas-arranger';
  turnId: `functional:canvas-arranger:${string}`;
  toolName?: 'view_canvas' | 'screenshot_canvas' | 'arrange_canvas';
  error?: 'invalid_request' | 'tool_error' | 'timeout' | 'cancelled' | 'agent_stopped' | 'conflict' | 'verification_failed' | 'unproven_latest';
  outcome?: 'completed' | 'partial' | 'failed' | 'cancelled' | 'conflict';
  result?: ArrangeCanvasDetails;
};

export interface CanvasArrangerOperation extends CanvasArrangeRequest {
  operationId: string;
  agentId: 'canvas-arranger';
  turnId: `functional:canvas-arranger:${string}`;
  cancelRequested: boolean;
  committed: boolean;
  terminal: boolean;
  outcome?: 'completed' | 'partial' | 'failed' | 'cancelled' | 'conflict';
  result?: ArrangeCanvasDetails;
}

export interface CanvasArrangerRuntimeOptions {
  repoRoot: string;
  vendorCliPath: string;
  getActiveStore: () => LocalWorldStore | null;
  eventSink?: (source: 'functional', event: JsonAgentSessionEvent, characterId: undefined, turnId: string) => void;
  activityFailureSink?: (source: 'functional', characterId: undefined, turnId: string, reason: 'timeout' | 'cancelled' | 'agent_stopped') => void;
  onRuntimeSignal?: (signal: CanvasArrangerRuntimeSignal) => void;
  /** Test seam; production uses RpcClient directly. */
  clientFactory?: (spec: LaunchSpec) => RpcClient;
}

const ARRANGER_TOOLS = new Set(['view_canvas', 'screenshot_canvas', 'arrange_canvas']);
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 120_000;
const DEFAULT_SPAWN_TIMEOUT_MS = 30_000;

function timeoutFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sameRequest(a: CanvasArrangerOperation, b: CanvasArrangeRequest): boolean {
  return a.worldId === b.worldId && a.layer === b.layer && a.requestId === b.requestId &&
    a.mode === b.mode && a.expectedRevision === b.expectedRevision &&
    a.expectedCanvasVersion === b.expectedCanvasVersion && a.snapshotId === b.snapshotId &&
    a.screenshotPolicy === b.screenshotPolicy;
}

function taskBrief(request: CanvasArrangeRequest, turnId: string): string {
  const quoted = (value: unknown) => JSON.stringify(value);
  return `CANVAS ARRANGER TASK

[Trusted operation]
Authorization: "player-click"
Source: "functional"
Agent ID: "canvas-arranger"
World ID: ${quoted(request.worldId)}
Request ID: ${quoted(request.requestId)}
Turn ID: ${quoted(turnId)}
Target layer: ${quoted(request.layer)}
Mode: ${quoted(request.mode)}
Expected revision: ${quoted(request.expectedRevision)}
Expected canvas version: ${quoted(request.expectedCanvasVersion)}
Snapshot ID: ${quoted(request.snapshotId)}
Output language: "en"
Cancellation requested: false
Screenshot policy: ${quoted(request.screenshotPolicy)}
Arrangement policy: "deoverlap"
Limits: {"normalArrangeCalls":1,"conflictArrangeCalls":1,"preScreenshots":1,"postScreenshots":1}

The player clicked Organize for this layer. Perform one bounded whole-layer de-overlap pass. Stable cards may move under this authorization, but world files, narrative text, frontmatter, gameplay, presence, Writer state and links must not be edited.

[Required sequence]
Call view_canvas with mode auto first. Use screenshot_canvas only when permitted by screenshot policy. Then call arrange_canvas once with the exact snapshot/version; after commit or no-op call view_canvas again. An uncommitted snapshot conflict may be retried once after a fresh view_canvas. Currentness cannot be proven: report conflict.

[Return]
Return only a CANVAS ARRANGER RESULT receipt with status, request/turn identity, snapshots, commit state, moved paths, overlap verification, visual evidence, reason and next action. Never output chain-of-thought or a Writer scene.`;
}

class RuntimeTimeout extends Error {
  constructor(public readonly kind: 'timeout' | 'agent_stopped') { super(kind); }
}

export class CanvasArrangerRuntime {
  private readonly opts: CanvasArrangerRuntimeOptions;
  private readonly operations = new Map<string, CanvasArrangerOperation>();
  private readonly inFlightByWorld = new Map<string, string>();
  private readonly operationByRequest = new Map<string, string>();
  private readonly runs = new Map<string, Promise<void>>();
  private readonly clients = new Map<string, RpcClient>();
  private readonly stores = new Map<string, LocalWorldStore>();

  constructor(options: CanvasArrangerRuntimeOptions) { this.opts = options; }

  async start(request: CanvasArrangeRequest): Promise<CanvasArrangeAccepted> {
    this.validateRequest(request);
    const requestKey = `${request.worldId}\u0000${request.requestId}`;
    const previousId = this.operationByRequest.get(requestKey);
    if (previousId) {
      const previous = this.operations.get(previousId)!;
      if (!sameRequest(previous, request)) throw new Error('Canvas arrangement requestId was reused with different input.');
      return this.accepted(previous);
    }
    const existingId = this.inFlightByWorld.get(request.worldId);
    if (existingId) {
      const existing = this.operations.get(existingId)!;
      if (!sameRequest(existing, request)) throw new Error('Canvas arrangement is already in progress for this world.');
      return this.accepted(existing);
    }
    const activeStore = this.opts.getActiveStore();
    if (!activeStore) throw new Error('No active world is available.');
    const operationId = randomUUID();
    const turnId = `functional:canvas-arranger:${randomUUID()}` as `functional:canvas-arranger:${string}`;
    const operation: CanvasArrangerOperation = {
      ...request, operationId, agentId: 'canvas-arranger', turnId,
      cancelRequested: false, committed: false, terminal: false,
    };
    this.operations.set(operationId, operation);
    this.operationByRequest.set(requestKey, operationId);
    this.inFlightByWorld.set(request.worldId, operationId);
    const run = this.run(operation);
    this.runs.set(operationId, run);
    void run.finally(() => this.runs.delete(operationId));
    return this.accepted(operation);
  }

  get(operationId: string): CanvasArrangerOperation | null {
    const operation = this.operations.get(operationId);
    return operation ? { ...operation } : null;
  }

  async cancel(operationId: string): Promise<{ ok: true; operationId: string; requestId: string; worldId: string; layer: string; stage: 'cancel_requested' | 'already_completed' | 'already_cancelled' }> {
    const operation = this.operations.get(operationId);
    if (!operation) throw new Error('Canvas arrangement operation was not found.');
    if (operation.terminal && operation.outcome === 'cancelled') return { ...this.cancelAck(operation), stage: 'already_cancelled' };
    if (operation.terminal) return { ...this.cancelAck(operation), stage: 'already_completed' };
    operation.cancelRequested = true;
    await this.clients.get(operationId)?.abort().catch(() => {});
    return { ...this.cancelAck(operation), stage: 'cancel_requested' };
  }
  private accepted(operation: CanvasArrangerOperation): CanvasArrangeAccepted {
    return {
      ok: true, operationId: operation.operationId, requestId: operation.requestId,
      worldId: operation.worldId, layer: operation.layer, agentId: 'canvas-arranger',
      turnId: operation.turnId, stage: 'accepted',
    };
  }

  private cancelAck(operation: CanvasArrangerOperation) {
    return { ok: true as const, operationId: operation.operationId, requestId: operation.requestId, worldId: operation.worldId, layer: operation.layer };
  }

  private validateRequest(request: CanvasArrangeRequest): void {
    if (!request || typeof request !== 'object') throw new Error('Invalid canvas arrangement request.');
    if (!request.worldId || !request.layer || !request.requestId || !request.snapshotId) throw new Error('Canvas arrangement identity is incomplete.');
    if (!/^[^\\/\n\r]+(?:\/[^\\/\n\r]+)*$/.test(request.layer) || request.layer.split('/').includes('..')) throw new Error('Invalid canvas layer.');
    if (!['grid', 'circle', 'row'].includes(request.mode)) throw new Error('Invalid canvas arrangement mode.');
    if (!Number.isInteger(request.expectedRevision) || request.expectedRevision < 0 || !Number.isInteger(request.expectedCanvasVersion) || request.expectedCanvasVersion < 0) throw new Error('Invalid canvas version fence.');
    if (!['none', 'before', 'after', 'before_and_after'].includes(request.screenshotPolicy)) throw new Error('Invalid screenshot policy.');
  }

  private signal(operation: CanvasArrangerOperation, type: CanvasArrangerRuntimeSignal['type'], extra: Omit<Partial<CanvasArrangerRuntimeSignal>, 'type'> = {}): void {
    this.opts.onRuntimeSignal?.({
      type, operationId: operation.operationId, requestId: operation.requestId,
      worldId: operation.worldId, layer: operation.layer, agentId: 'canvas-arranger',
      turnId: operation.turnId, ...extra,
    });
  }

  private async run(operation: CanvasArrangerOperation): Promise<void> {
    try {
      await this.runAttempt(operation);
    } catch (error) {
      if (operation.terminal) return;
      const timedOut = error instanceof RuntimeTimeout && error.kind === 'timeout';
      const cancelled = operation.cancelRequested;
      const outcome = operation.committed ? 'conflict' : cancelled ? 'cancelled' : 'failed';
      const reason = timedOut ? 'Canvas arranger timed out.' : cancelled ? 'Canvas arrangement was cancelled.' : 'Canvas arranger agent stopped before settlement.';
      const errorCode = operation.committed ? 'unproven_latest' : timedOut ? 'timeout' : cancelled ? 'cancelled' : 'agent_stopped';
      this.finish(operation, outcome, errorCode, reason);
    }
  }

  private async runAttempt(operation: CanvasArrangerOperation): Promise<void> {
    if (operation.cancelRequested) throw new RuntimeTimeout('agent_stopped');
    const store = this.stores.get(operation.operationId);
    if (!store || this.opts.getActiveStore() !== store) throw new RuntimeTimeout('agent_stopped');
    const spec = canvasArrangerLaunch(this.opts.repoRoot, store.worldRoot, this.opts.vendorCliPath, operation.operationId, operation.turnId);
    const client = this.opts.clientFactory?.(spec) ?? new RpcClient({ cliPath: spec.cliPath, cwd: spec.cwd, args: spec.args, env: spec.env });
    this.clients.set(operation.operationId, client);
    let settled = false;
    let sawAgentStart = false;
    let sawView = false;
    let sawPostView = false;
    let arrangeCalls = 0;
    let preScreenshots = 0;
    let postScreenshots = 0;
    let protocolError: Error | null = null;
    let spawnTimer: NodeJS.Timeout | undefined;
    let idleTimer: NodeJS.Timeout | undefined;
    let totalTimer: NodeJS.Timeout | undefined;
    let timeoutRequested = false;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { timeoutRequested = true; void client.abort().catch(() => {}); }, timeoutFromEnv('AIRP_ARRANGER_IDLE_TIMEOUT_MS', DEFAULT_IDLE_TIMEOUT_MS));
      idleTimer.unref?.();
    };
    const eventOff = client.onEvent((event) => {
      this.opts.eventSink?.('functional', event, undefined, operation.turnId);
      if (event.type === 'agent_start') {
        sawAgentStart = true;
        clearTimeout(totalTimer);
        totalTimer = setTimeout(() => { timeoutRequested = true; void client.abort().catch(() => {}); }, timeoutFromEnv('AIRP_ARRANGER_TOTAL_TIMEOUT_MS', DEFAULT_TOTAL_TIMEOUT_MS));
        totalTimer.unref?.();
        resetIdle();
      } else if (event.type === 'tool_execution_start') {
        resetIdle();
        if (!ARRANGER_TOOLS.has(event.toolName)) {
          protocolError = new Error(`Unauthorized tool: ${event.toolName}.`);
        } else if (event.toolName === 'arrange_canvas' && (!sawView || arrangeCalls >= 1)) {
          protocolError = new Error('arrange_canvas requires one preceding view_canvas and a single-flight call.');
        } else if (event.toolName === 'screenshot_canvas' && (!sawView || (operation.committed ? postScreenshots >= 1 : preScreenshots >= 1))) {
          protocolError = new Error('screenshot_canvas was called outside its bounded budget.');
        } else {
          if (event.toolName === 'arrange_canvas') arrangeCalls++;
          if (event.toolName === 'screenshot_canvas') operation.committed ? postScreenshots++ : preScreenshots++;
          this.signal(operation, 'tool_started', { toolName: event.toolName as CanvasArrangerRuntimeSignal['toolName'] });
        }
        if (protocolError) void client.abort().catch(() => {});
      } else if (event.type === 'tool_execution_end') {
        resetIdle();
        const toolName = ARRANGER_TOOLS.has(event.toolName) ? event.toolName as CanvasArrangerRuntimeSignal['toolName'] : undefined;
        this.signal(operation, 'tool_completed', { toolName });
        if (event.toolName === 'view_canvas' && !event.isError) {
          if (operation.committed) sawPostView = true;
          else sawView = true;
        }
        if (event.toolName === 'arrange_canvas' && !event.isError) {
          operation.committed = true;
          const result = event.result && typeof event.result === 'object' && 'details' in event.result ? event.result.details as ArrangeCanvasDetails : undefined;
          if (result) operation.result = result;
          this.signal(operation, 'committed', { toolName: 'arrange_canvas', result });
        }
      } else if (event.type === 'agent_settled') {
        settled = true;
      }
    });
    try {
      spawnTimer = setTimeout(() => { timeoutRequested = true; void client.abort().catch(() => {}); }, timeoutFromEnv('AIRP_ARRANGER_SPAWN_TIMEOUT_MS', DEFAULT_SPAWN_TIMEOUT_MS));
      spawnTimer.unref?.();
      idleTimer = setTimeout(() => {}, DEFAULT_IDLE_TIMEOUT_MS);
      totalTimer = setTimeout(() => { void client.abort().catch(() => {}); }, timeoutFromEnv('AIRP_ARRANGER_TOTAL_TIMEOUT_MS', DEFAULT_TOTAL_TIMEOUT_MS));
      await client.start();
      clearTimeout(spawnTimer);
      this.signal(operation, 'spawned');
      if (operation.cancelRequested) throw new RuntimeTimeout('agent_stopped');
      await client.prompt(taskBrief(operation, operation.turnId));
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new RuntimeTimeout('timeout')), timeoutFromEnv('AIRP_ARRANGER_TOTAL_TIMEOUT_MS', DEFAULT_TOTAL_TIMEOUT_MS) + 1000);
        const check = setInterval(() => {
          if (settled) { clearInterval(check); clearTimeout(deadline); resolve(); }
          else if (operation.cancelRequested) { clearInterval(check); clearTimeout(deadline); reject(new RuntimeTimeout('agent_stopped')); }
        }, 25);
        check.unref?.();
      });
      if (timeoutRequested) throw new RuntimeTimeout('timeout');
      if (!sawAgentStart || !sawView) throw new RuntimeTimeout('agent_stopped');
      if (operation.committed && !sawPostView) throw new RuntimeTimeout('agent_stopped');
      await this.verify(operation);
    } finally {
      clearTimeout(spawnTimer);
      clearTimeout(idleTimer);
      clearTimeout(totalTimer);
      eventOff();
      this.clients.delete(operation.operationId);
      await client.stop().catch(() => {});
    }
  }

  private async verify(operation: CanvasArrangerOperation): Promise<void> {
    const store = this.stores.get(operation.operationId);
    if (!store || this.opts.getActiveStore() !== store) {
      this.finish(operation, 'conflict', 'unproven_latest', 'The active world changed before verification.');
      return;
    }
    if (!operation.committed) {
      this.finish(operation, 'failed', 'verification_failed', 'The arranger settled without a committed arrange_canvas action.');
      return;
    }
    try {
      const [snapshot, currentRevision] = await Promise.all([
        readCanvasSnapshot(store, { layer: operation.layer }),
        store.getMaxSeq(),
      ]);
      if (currentRevision !== operation.expectedRevision) {
        this.finish(operation, 'conflict', 'conflict', 'World revision changed before verification.');
        return;
      }
      if (snapshot.layer.id !== operation.layer || snapshot.overlaps.length !== 0) {
        this.finish(operation, 'conflict', 'verification_failed', 'Fresh full-layer verification did not prove a collision-free current canvas.');
        return;
      }
      if (operation.result && snapshot.identity.canvasVersion < operation.result.canvasVersion) {
        this.finish(operation, 'conflict', 'unproven_latest', 'Canvas version moved backwards during verification.');
        return;
      }
      if (operation.result) {
        operation.result = {
          ...operation.result,
          snapshotIdAfter: snapshot.identity.snapshotId,
          canvasVersion: snapshot.identity.canvasVersion,
          canvasRevision: snapshot.identity.canvasRevision,
          overlapCount: snapshot.overlaps.length,
        };
      }
      this.signal(operation, 'verified', { result: operation.result });
      this.finish(
        operation,
        operation.cancelRequested ? 'cancelled' : 'completed',
        operation.cancelRequested ? 'cancelled' : undefined,
        operation.cancelRequested ? 'Arrangement committed before cancellation.' : undefined,
      );
    } catch {
      this.finish(operation, 'conflict', 'unproven_latest', 'Canvas verification failed.');
    }
  }

  private finish(
    operation: CanvasArrangerOperation,
    outcome: NonNullable<CanvasArrangerOperation['outcome']>,
    error?: CanvasArrangerRuntimeSignal['error'],
    _reason?: string,
  ): void {
    if (operation.terminal) return;
    operation.terminal = true;
    operation.outcome = outcome;
    this.inFlightByWorld.delete(operation.worldId);
    const type = outcome === 'conflict' ? 'conflict' : outcome === 'cancelled' ? 'cancelled' : outcome === 'completed' ? 'verified' : 'failed';
    this.signal(operation, type, { outcome, error, result: operation.result });
    if (error && (error === 'timeout' || error === 'cancelled' || error === 'agent_stopped')) {
      this.opts.activityFailureSink?.('functional', undefined, operation.turnId, error);
    }
  }
}
