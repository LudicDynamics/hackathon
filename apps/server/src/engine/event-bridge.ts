import fs from 'node:fs';
import type { WebSocketServer } from 'ws';
import type { JsonAgentSessionEvent } from '../../../../vendor/pi-rp/packages/coding-agent/dist/index.js';

export type EventSource = 'writer' | 'character';
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
 * Translates one pi-rp `JsonAgentSessionEvent` into zero or more AIRP WS messages.
 *
 * Deliberately a pure function — the bridge (and the probe) can call it directly
 * without a live WebSocket. `toolArgs` is the caller-owned call-id → args map that
 * lets `tool_execution_end` recover the path a `write`/`chalk` targeted; the
 * function reads and prunes it, so a long session never accumulates entries.
 *
 * Events outside the table (`agent_start`/`turn_*`/`message_start`/…) map to `[]`:
 * B0 forwards only the frames the frontend's ink/brush work consumes.
 */
export function mapEngineEvent(
  source: EventSource,
  event: JsonAgentSessionEvent,
  toolArgs: Map<string, any>
): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  const push = (msg: Record<string, any>) => out.push({ ...msg, timestamp: new Date().toISOString() });

  switch (event.type) {
    case 'message_update': {
      const assistantEvent = event.assistantMessageEvent;
      if (assistantEvent?.type === 'text_delta' && assistantEvent.delta) {
        push({
          type: source === 'writer' ? 'writer_delta' : 'character_delta',
          source,
          delta: assistantEvent.delta,
        });
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
    case 'tool_execution_end': {
      const args = toolArgs.get(event.toolCallId);
      toolArgs.delete(event.toolCallId);
      push({
        type: 'tool_end',
        source,
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        isError: event.isError,
      });
      if (event.toolName === 'chalk' || event.toolName === 'write') {
        const landed: Record<string, any> = { type: 'chalk_landed', source };
        if (args?.path) landed.path = args.path;
        push(landed);
      }
      if (event.toolName === 'link' || event.toolName === 'arrange') {
        push({ type: 'canvas_patched', source });
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

export class EventBridge {
  private wss: WebSocketServer | null = null;
  private fileWatcher: fs.FSWatcher | null = null;
  private watchDebounceTimer: NodeJS.Timeout | null = null;
  private toolArgsByCallId = new Map<string, any>();

  setWss(wss: WebSocketServer): void {
    this.wss = wss;
  }

  broadcast(message: Record<string, any>): void {
    if (!this.wss) return;
    const payload = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(payload);
      }
    }
  }

  /** Fan an engine event out to every WS client as the mapped AIRP frames. */
  emitEngine(source: EventSource, event: JsonAgentSessionEvent): void {
    for (const message of mapEngineEvent(source, event, this.toolArgsByCallId)) {
      this.broadcast(message);
    }
  }

  watchWorld(worldRoot: string): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    try {
      this.fileWatcher = fs.watch(worldRoot, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        if (filename.includes('.airpworld') || filename.includes('node_modules')) return;

        if (this.watchDebounceTimer) clearTimeout(this.watchDebounceTimer);
        this.watchDebounceTimer = setTimeout(() => {
          this.broadcast({
            type: 'file_changed',
            eventType,
            filename,
            timestamp: new Date().toISOString(),
          });
        }, 150);
      });
    } catch (err) {
      console.warn('[EventBridge] Could not watch world directory:', err);
    }
  }

  close(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
  }
}
