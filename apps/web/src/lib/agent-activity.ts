export type ActivityEntry = { id: string; actor: string; kind: 'tool' | 'world' | 'final'; label: string; target?: string; state: 'running' | 'done' | 'failed' | 'interrupted'; time: string };
export type ActivityState = { entries: ActivityEntry[]; writerPhase: 'idle' | 'working' | 'settled' | 'interrupted'; writerStartedAt: number; summary: string; completed: number; changes: number; seen: string[] };
export const emptyActivity = (): ActivityState => ({ entries: [], writerPhase: 'idle', writerStartedAt: 0, summary: '', completed: 0, changes: 0, seen: [] });
const TOOL_LABELS: Record<string, string> = { read: 'Read file', look_at: 'Inspect object', view_canvas: 'Inspect scene', write: 'Write file', edit: 'Update file', chalk: 'Write Chalk', move: 'Move item', move_to: 'Enter scene', choose: 'Record choice', roll_dice: 'Roll dice', use_item_on: 'Use item', generate_image: 'Generate image', link: 'Link objects', arrange: 'Arrange scene', show: 'Play effect', delete: 'Remove entity', set_following: 'Update companion' };
const EVENT_LABELS: Record<string, string> = { entity_created: 'Created', entity_edited: 'Updated', entity_moved: 'Moved', entity_deleted: 'Removed', layer_initialized: 'Scene created', choice_selected: 'Choice recorded', roll_resolved: 'Dice recorded', use_item_on: 'Item use recorded' };

/** Never surface raw tool arguments, file bodies, prompts, secrets, or hidden reasoning. */
export function safeActivityText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/sk-[\w-]+/g, '[redacted]').replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').replace(/\s+/g, ' ').trim().slice(0, 800);
}
function safeTarget(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.map(safeTarget).filter(Boolean).slice(0, 3).join(', ') || undefined;
  if (typeof value !== 'string') return;
  const match = value.match(/(?:^|\/)((?:world|player|characters|skills)\/[^\r\n]*)$/);
  if (!match || match[1].includes('..') || /(?:\.env|auth|credential|secret|token)/i.test(match[1])) return;
  return safeActivityText(match[1]);
}

export function reduceActivity(previous: ActivityState, frame: Record<string, any>): ActivityState {
  let state = previous;
  const writer = frame.source === 'writer';
  const actor = writer ? 'Writer' : `Character: ${safeActivityText(frame.characterId) || 'companion'}`;
  const time = typeof frame.timestamp === 'string' ? frame.timestamp : '';
  const push = (entry: ActivityEntry) => { state = { ...state, entries: [...state.entries, entry].slice(-80) }; };
  const begin = (startedAt = state.writerStartedAt) => {
    state = { ...state, writerPhase: 'working', writerStartedAt: startedAt, summary: '', completed: 0, changes: 0 };
  };
  if (writer && frame.type === 'agent_progress' && frame.busy && Number(frame.startedAt) > state.writerStartedAt) begin(Number(frame.startedAt));
  if (['tool_start', 'tool_end'].includes(frame.type) && ['writer', 'character'].includes(frame.source) && typeof frame.toolCallId === 'string') {
    const id = `${actor}:${frame.toolCallId}`;
    const existing = state.entries.find(entry => entry.id === id);
    if (frame.type === 'tool_start') {
      if (existing) return state;
      if (writer && state.writerPhase !== 'working') begin();
      push({ id, actor, kind: 'tool', label: TOOL_LABELS[frame.toolName] || 'Run action', target: safeTarget(frame.args?.path ?? frame.args?.item ?? frame.args?.target), state: 'running', time });
    } else {
      if (existing && existing.state !== 'running') return state;
      const status = frame.isError ? 'failed' : 'done';
      if (existing) state = { ...state, entries: state.entries.map(entry => entry.id === id ? { ...entry, state: status } : entry) };
      else push({ id, actor, kind: 'tool', label: TOOL_LABELS[frame.toolName] || 'Run action', state: status, time });
      if (writer && !frame.isError) state = { ...state, completed: state.completed + 1 };
    }
  }
  if (frame.type === 'world_event') {
    const event = frame.event;
    if (!event || typeof event.id !== 'string' || state.seen.includes(event.id) || !['writer', 'character'].includes(event.actor?.type)) return state;
    const label = EVENT_LABELS[event.type];
    if (!label) return state;
    state = { ...state, seen: [...state.seen, event.id].slice(-512) };
    const detail = event.detail || {};
    push({ id: event.id, actor: event.actor.type === 'writer' ? 'Writer' : `Character: ${safeActivityText(event.actor.id) || 'companion'}`, kind: 'world', label, target: safeTarget(detail.path ?? detail.to ?? event.subject), state: 'done', time: event.createdAt || time });
    if (event.actor.type === 'writer') state = { ...state, changes: state.changes + 1 };
  }
  if (writer && frame.type === 'writer_message') state = { ...state, summary: safeActivityText(frame.text) };
  if (writer && ['error', 'turn_aborted'].includes(frame.type)) {
    state = { ...state, writerPhase: 'interrupted', entries: state.entries.map(entry => entry.actor === 'Writer' && entry.state === 'running' ? { ...entry, state: 'interrupted' } : entry) };
  }
  if (writer && frame.type === 'writer_idle' && state.writerPhase === 'working') state = { ...state, writerPhase: 'settled' };
  return state;
}
