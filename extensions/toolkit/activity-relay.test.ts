import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentSession, AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import {
  AGENT_ACTIVITY_CUSTOM_TYPE,
  observeSubagentSession,
  relayActivityViaParentMessage,
  type ActivityTurnContext,
} from './activity-relay.js';
interface RelayedEvent {
  type: string;
  context: ActivityTurnContext;
}


test('child observer relays tool events with a child turn id', () => {
  let listener: ((event: AgentSessionEvent) => void) | undefined;
  let unsubscribeCalls = 0;
  const relayed: unknown[] = [];
  const session: Pick<AgentSession, 'subscribe'> = {
    subscribe(next) {
      listener = next;
      return () => {
        unsubscribeCalls += 1;
      };
    },
  };
  const emit = (event: unknown) => {
    const typedEvent = event as AgentSessionEvent;
    listener?.(typedEvent);
  };
  const root: ActivityTurnContext = { source: 'functional', agentId: 'scene-init', turnId: 'functional:root' };
  const stop = observeSubagentSession(session, root, (event) => relayed.push(event));

  emit({ type: 'turn_start', turnIndex: 2 });
  emit({ type: 'tool_execution_start', toolCallId: 'child-1', toolName: 'write', args: { path: 'world/scene/README.md' } });
  emit({
    type: 'tool_execution_end',
    toolCallId: 'child-1',
    toolName: 'write',
    isError: false,
    result: { details: { path: 'world/scene/README.md' } },
  });
  stop();
  emit({ type: 'tool_execution_start', toolCallId: 'ignored', toolName: 'read' });

  const first = relayed[0] as RelayedEvent;
  const second = relayed[1] as RelayedEvent;
  assert.equal(relayed.length, 2);
  assert.equal(first.type, 'tool_start');
  assert.equal(second.type, 'tool_end');
  assert.equal(first.context.agentId, 'scene-init');
  assert.match(first.context.turnId, /^functional:root:child:2:/);
  assert.equal(unsubscribeCalls, 1);
});

test('relay sends a hidden non-triggering custom message', () => {
  const calls: Array<{ message: { customType: string; content: string; display: boolean }; triggerTurn: boolean }> = [];
  relayActivityViaParentMessage(
    (message, options) => {
      calls.push({ message, triggerTurn: options.triggerTurn });
    },
    { source: 'functional', agentId: 'nook-init', turnId: 'functional:root' },
    { type: 'tool_start', toolCallId: 'child-1', toolName: 'read', args: { path: 'characters/watson/README.md' } },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].message.customType, AGENT_ACTIVITY_CUSTOM_TYPE);
  assert.equal(calls[0].message.display, false);
  assert.equal(calls[0].triggerTurn, false);
  assert.equal(JSON.parse(calls[0].message.content).context.agentId, 'nook-init');
});
