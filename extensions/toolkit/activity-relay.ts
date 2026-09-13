import type { AgentSession } from '@earendil-works/pi-coding-agent';

export const AGENT_ACTIVITY_CUSTOM_TYPE = 'airp_agent_activity';

export type ActivitySource = 'writer' | 'character' | 'functional';

export interface ActivityTurnContext {
  source: ActivitySource;
  agentId: string;
  turnId: string;
}

/** Transport-only child event. The server validates this before projection. */
export interface ChildActivityEnvelope {
  type: 'tool_start' | 'tool_end';
  context: ActivityTurnContext;
  toolCallId: string;
  toolName: string;
  args?: unknown;
  details?: unknown;
  isError?: boolean;
  errorKind?: 'tool_error' | 'timeout' | 'cancelled' | 'agent_stopped';
}

export type ActivityRelay = (envelope: ChildActivityEnvelope) => void;

type ParentSendMessage = (
  message: { customType: string; content: string; display: boolean },
  options: { triggerTurn: false },
) => Promise<void> | void;

const MAX_TOOL_CALL_ID_LENGTH = 256;
const MAX_TOOL_NAME_LENGTH = 128;
const MAX_SERIALIZED_PAYLOAD_LENGTH = 32_768;


function isValidContext(context: ActivityTurnContext): boolean {
  return (
    (context.source === 'functional' || context.source === 'writer' || context.source === 'character') &&
    typeof context.agentId === 'string' &&
    context.agentId.length > 0 &&
    context.agentId.length <= 128 &&
    typeof context.turnId === 'string' &&
    context.turnId.length > 0 &&
    context.turnId.length <= 256
  );
}

function safePayload(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined || encoded.length > MAX_SERIALIZED_PAYLOAD_LENGTH) return undefined;
    return JSON.parse(encoded) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Send a validated, hidden custom message to the parent session. The custom
 * message is transport only; the server performs the final schema/safety check.
 */
export function relayActivityViaParentMessage(
  sendMessage: ParentSendMessage,
  context: ActivityTurnContext,
  event: Omit<ChildActivityEnvelope, 'context'> | ChildActivityEnvelope,
): void {
  if (!isValidContext(context)) return;

  const toolCallId = event.toolCallId;
  const toolName = event.toolName;
  if (
    (event.type !== 'tool_start' && event.type !== 'tool_end') ||
    typeof toolCallId !== 'string' ||
    toolCallId.length === 0 ||
    toolCallId.length > MAX_TOOL_CALL_ID_LENGTH ||
    typeof toolName !== 'string' ||
    toolName.length === 0 ||
    toolName.length > MAX_TOOL_NAME_LENGTH
  ) {
    return;
  }

  const safeArgs = safePayload(event.args);
  const safeDetails = safePayload(event.details);
  const envelope: ChildActivityEnvelope = {
    type: event.type,
    context,
    toolCallId,
    toolName,
    ...(safeArgs !== undefined ? { args: safeArgs } : {}),
    ...(safeDetails !== undefined ? { details: safeDetails } : {}),
    ...(typeof event.isError === 'boolean' ? { isError: event.isError } : {}),
    ...(event.errorKind ? { errorKind: event.errorKind } : {}),
  };

  const content = JSON.stringify(envelope);
  try {
    const result = sendMessage(
      { customType: AGENT_ACTIVITY_CUSTOM_TYPE, content, display: false },
      { triggerTurn: false },
    );
    void Promise.resolve(result).catch(() => undefined);
  } catch {
    // A disposed/replaced parent cannot receive a terminal relay. The parent
    // server-side lifecycle remains responsible for closing open activity.
  }
}

function childTurnId(context: ActivityTurnContext, turnIndex: number): string {
  // Keep a stable opaque id per child engine turn without exposing session data.
  return `${context.turnId}:child:${turnIndex}:${crypto.randomUUID()}`;
}

/**
 * Subscribe before a child session is continued. Turn lifecycle is local to the
 * observer; only tool start/end envelopes cross the parent custom-message seam.
 */
export function observeSubagentSession(
  session: Pick<AgentSession, 'subscribe'>,
  context: ActivityTurnContext,
  relay: ActivityRelay,
): () => void {
  let active = true;
  let currentTurnId: string | undefined;
  let fallbackTurnIndex = 0;

  const unsubscribe = session.subscribe((event: unknown) => {
    if (
      !active ||
      event === null ||
      typeof event !== 'object' ||
      Array.isArray(event) ||
      !('type' in event) ||
      typeof event.type !== 'string'
    ) {
      return;
    }

    if (event.type === 'turn_start') {
      const index = 'turnIndex' in event && typeof event.turnIndex === 'number' ? event.turnIndex : fallbackTurnIndex++;
      currentTurnId = childTurnId(context, index);
      return;
    }

    if (event.type === 'turn_end') {
      currentTurnId = undefined;
      return;
    }

    if (event.type !== 'tool_execution_start' && event.type !== 'tool_execution_end') return;
    if (currentTurnId === undefined) {
      currentTurnId = childTurnId(context, fallbackTurnIndex++);
    }

    const toolCallId = 'toolCallId' in event ? event.toolCallId : undefined;
    const toolName = 'toolName' in event ? event.toolName : undefined;
    if (typeof toolCallId !== 'string' || typeof toolName !== 'string') return;

    const result =
      'result' in event && typeof event.result === 'object' && event.result !== null && !Array.isArray(event.result)
        ? event.result
        : undefined;
    const details = result && 'details' in result ? result.details : undefined;
    const envelope: ChildActivityEnvelope = {
      type: event.type === 'tool_execution_start' ? 'tool_start' : 'tool_end',
      context: { ...context, turnId: currentTurnId },
      toolCallId,
      toolName,
      ...(event.type === 'tool_execution_start' && 'args' in event ? { args: event.args } : {}),
      ...(details !== undefined ? { details } : {}),
      ...('isError' in event && typeof event.isError === 'boolean' ? { isError: event.isError } : {}),
    };
    relay(envelope);
  });

  return () => {
    if (!active) return;
    active = false;
    unsubscribe();
  };
}
