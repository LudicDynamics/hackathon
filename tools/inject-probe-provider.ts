/**
 * Deterministic provider for the engine-spawn injection probe (`tools/probe-inject.mjs`).
 *
 * Lives in `tools/` on purpose — `presets.ts::extensionArgs` only scans `extensions/`
 * and `<worldRoot>/extensions/`, so this file can never be loaded by a production run.
 * The probe passes it explicitly with `--extension`.
 *
 * Its ONE job beyond scripting the turns: append the FINAL wire messages of every
 * provider request to `AIRP_INJECT_PROBE_OUT` as one JSON line per request.
 * `RpcClient` runs the agent as a CHILD process, so the probe cannot read this
 * process's memory — the file is the only observation channel (06 §6.2).
 *
 * `context.messages` is post-`convertToLlm`: exactly what the model sees, which is
 * the same vantage point AUDIT S1/S2 used.
 *
 * Script (by request index, not by user turn — an in-run tool loop adds requests):
 *   request 1 → plain text
 *   request 2 → one AIRP `chalk` tool call (forces a tool loop, so one user turn
 *               produces several requests — the A4 case)
 *   request 3+ → plain text
 */
import fs from 'node:fs';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai/compat';

const PROVIDER_ID = 'airp-inject-probe';
const MODEL_ID = 'deterministic';

const PROBE_CHALK_PATH = 'world/baker-street/inject-probe-chalk.md';

let requestIndex = 0;

/** Flatten a wire message's content (string | block[]) to plain text. */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block: any) => (block && typeof block.text === 'string' ? block.text : ''))
    .filter((s: string) => s !== '')
    .join('\n');
}

function usage(): Record<string, unknown> {
  return {
    input: 10,
    output: 20,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 30,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function assistantMessage(model: any, content: unknown[], stopReason: string): Record<string, unknown> {
  return {
    role: 'assistant',
    content,
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: usage(),
    stopReason,
    timestamp: Date.now(),
  };
}

function streamScript(stream: any, message: any): void {
  stream.push({ type: 'start', partial: { ...message, content: [], stopReason: 'pending' } });
  message.content.forEach((block: any, i: number) => {
    if (block.type === 'text') {
      stream.push({ type: 'text_start', contentIndex: i, partial: message });
      stream.push({ type: 'text_delta', contentIndex: i, delta: block.text, partial: message });
      stream.push({ type: 'text_end', contentIndex: i, content: block.text, partial: message });
    } else if (block.type === 'toolCall') {
      stream.push({ type: 'toolcall_start', contentIndex: i, partial: message });
      stream.push({
        type: 'toolcall_delta',
        contentIndex: i,
        delta: JSON.stringify(block.arguments),
        partial: message,
      });
      stream.push({ type: 'toolcall_end', contentIndex: i, toolCall: block, partial: message });
    }
  });
  stream.push({ type: 'done', reason: message.stopReason, message });
  stream.end(message);
}

/** Record this request's wire view for the probe, then scripted-reply. */
function record(context: any, index: number): void {
  const out = process.env.AIRP_INJECT_PROBE_OUT;
  if (!out) return;
  const line = JSON.stringify({
    requestIndex: index,
    texts: (context?.messages ?? []).map((m: any) => textOf(m.content)),
  });
  try {
    fs.appendFileSync(out, line + '\n');
  } catch {
    // The probe will fail its "no requests recorded" assertion; never derail the run.
  }
}

export default function injectProbeProvider(pi: any): void {
  pi.registerProvider(PROVIDER_ID, {
    name: 'AIRP Inject Probe (deterministic)',
    baseUrl: 'http://127.0.0.1:0',
    apiKey: 'probe-key',
    api: 'openai-completions',
    models: [
      {
        id: MODEL_ID,
        name: 'Deterministic inject-probe model',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
    ],
    streamSimple: (model: any, context: any) => {
      const index = ++requestIndex;
      record(context, index);
      const stream = createAssistantMessageEventStream();
      const message =
        index === 2
          ? assistantMessage(
              model,
              [
                {
                  type: 'toolCall',
                  id: `inject_probe_${index}`,
                  // An AIRP tool registered by `extensions/tools.ts`; a plain
                  // scripted turn would leave the tool loop uncovered (A4).
                  name: 'chalk',
                  arguments: {
                    path: PROBE_CHALK_PATH,
                    content: '# Inject Probe\n\nThe tool loop is covered.',
                  },
                },
              ],
              'toolUse'
            )
          : assistantMessage(model, [{ type: 'text', text: 'probe turn done' }], 'stop');
      queueMicrotask(() => streamScript(stream, message));
      return stream;
    },
  });
}
